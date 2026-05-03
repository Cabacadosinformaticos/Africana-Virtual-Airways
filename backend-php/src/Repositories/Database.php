<?php

declare(strict_types=1);

namespace AFV\Repositories;

use AFV\Config\FlightNetwork;
use AFV\Helpers\DistanceHelper;

class Database
{
    private static ?\PDO $pdo = null;

    public static function getConnection(): \PDO
    {
        if (self::$pdo === null) {
            throw new \RuntimeException('Database has not been initialized yet');
        }
        return self::$pdo;
    }

    public static function initialize(): void
    {
        if (self::$pdo !== null) return;

        $host     = getenv('DB_HOST')     ?: '127.0.0.1';
        $port     = (int) (getenv('DB_PORT') ?: 3306);
        $user     = getenv('DB_USER')     ?: 'root';
        $password = getenv('DB_PASSWORD') ?: '';
        $dbName   = getenv('DB_NAME')     ?: 'afv_booking';

        // Create the database if it doesn't exist
        $admin = new \PDO(
            "mysql:host={$host};port={$port};charset=utf8mb4",
            $user,
            $password,
            [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]
        );
        $admin->exec("CREATE DATABASE IF NOT EXISTS `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $admin = null;

        self::$pdo = new \PDO(
            "mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4",
            $user,
            $password,
            [
                \PDO::ATTR_ERRMODE            => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
                \PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );

        self::runSchema();
        self::ensureSchemaMigrations();
        self::backfillBookingChildren();
        self::ensurePrimaryAdmin();
        self::seedAircraft();
        self::ensureAircraftImages();
        self::seedAirports();
        self::seedRoutesAndSchedules();
        self::seedAirlineStats();
    }

    // ── Schema ────────────────────────────────────────────────────────────────

    private static function runSchema(): void
    {
        $schemaPath = defined('PROJECT_ROOT')
            ? PROJECT_ROOT . '/database/mysql.sql'
            : dirname(__DIR__, 3) . '/database/mysql.sql';

        if (!file_exists($schemaPath)) {
            error_log('[AFV] Schema file not found at ' . $schemaPath);
            return;
        }

        $sql        = file_get_contents($schemaPath);
        $statements = array_filter(array_map('trim', preg_split('/;\s*(\r?\n|$)/', $sql)));
        foreach ($statements as $stmt) {
            self::$pdo->exec($stmt);
        }
    }

    private static function ensureSchemaMigrations(): void
    {
        self::ensureColumn('users', 'is_primary_admin', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER role');
        self::ensureColumn('users', 'created_by_user_id', 'INT NULL AFTER is_primary_admin');
        self::ensureIndex('users', 'idx_users_created_by', 'ALTER TABLE users ADD INDEX idx_users_created_by (created_by_user_id)');
    }

    private static function ensureColumn(string $table, string $column, string $definition): void
    {
        $stmt = self::$pdo->query("SHOW COLUMNS FROM `{$table}` LIKE '{$column}'");
        if (!$stmt->fetch()) {
            self::$pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$definition}");
        }
    }

    private static function ensureIndex(string $table, string $indexName, string $statement): void
    {
        $stmt = self::$pdo->query("SHOW INDEX FROM `{$table}` WHERE Key_name = '{$indexName}'");
        if (!$stmt->fetch()) {
            self::$pdo->exec($statement);
        }
    }

    // ── Backfill ──────────────────────────────────────────────────────────────

    private static function backfillBookingChildren(): void
    {
        $rows = self::$pdo->query(
            "SELECT
                b.id, b.booking_ref, b.seat_selection, b.passenger_details, b.itinerary,
                COALESCE(bp.passenger_count, 0) AS passenger_count,
                COALESCE(bs.segment_count, 0) AS segment_count
              FROM bookings b
              LEFT JOIN (SELECT booking_id, COUNT(*) AS passenger_count FROM booking_passengers GROUP BY booking_id) bp ON bp.booking_id = b.id
              LEFT JOIN (SELECT booking_id, COUNT(*) AS segment_count FROM booking_segments GROUP BY booking_id) bs ON bs.booking_id = b.id
              WHERE COALESCE(bp.passenger_count,0) = 0 OR COALESCE(bs.segment_count,0) = 0"
        )->fetchAll();

        if (!$rows) return;

        self::$pdo->beginTransaction();
        try {
            foreach ($rows as $row) {
                $passengers = self::parseJsonSeed($row['passenger_details'], []);
                $itinerary  = self::parseJsonSeed($row['itinerary'], ['segments' => []]);
                $segments   = $itinerary['segments'] ?? [];

                if ((int) $row['passenger_count'] === 0) {
                    foreach ($passengers as $i => $p) {
                        $stmt = self::$pdo->prepare(
                            "INSERT INTO booking_passengers (booking_id, passenger_index, first_name, last_name, email, phone, nationality, seat_selection)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
                        );
                        $stmt->execute([
                            $row['id'], $i,
                            trim((string) ($p['firstName'] ?? '')),
                            trim((string) ($p['lastName'] ?? '')),
                            strtolower(trim((string) ($p['email'] ?? ''))),
                            !empty($p['phone']) ? trim((string) $p['phone']) : null,
                            !empty($p['nationality']) ? trim((string) $p['nationality']) : null,
                            $p['seat'] ?? ($i === 0 ? ($row['seat_selection'] ?? null) : null),
                        ]);
                    }
                }

                if ((int) $row['segment_count'] === 0) {
                    foreach ($segments as $i => $seg) {
                        $stmt = self::$pdo->prepare(
                            "INSERT INTO booking_segments
                              (booking_id, segment_index, route_id, flight_number, from_airport, to_airport,
                               departure_date, arrival_date, departure_time, arrival_time,
                               departure_datetime, arrival_datetime, duration_minutes, distance_km,
                               aircraft_id, aircraft_registration, aircraft_type)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                        );
                        $stmt->execute([
                            $row['id'], $i,
                            $seg['routeId'] ?? null,
                            $seg['flightNumber'],
                            $seg['from'],
                            $seg['to'],
                            $seg['departureDate'],
                            $seg['arrivalDate'] ?? $seg['departureDate'],
                            $seg['departure'] ?? '',
                            $seg['arrival'] ?? '',
                            self::normalizeSeedDT($seg['departureDateTime'] ?? null, $seg['departureDate']),
                            self::normalizeSeedDT($seg['arrivalDateTime'] ?? null, $seg['arrivalDate'] ?? $seg['departureDate']),
                            $seg['durationMinutes'] ?? 0,
                            $seg['distanceKm'] ?? 0,
                            $seg['aircraft']['id'] ?? null,
                            $seg['aircraft']['registration'] ?? null,
                            $seg['aircraft']['type'] ?? null,
                        ]);
                    }
                }
            }
            self::$pdo->commit();
        } catch (\Throwable $e) {
            self::$pdo->rollBack();
            throw $e;
        }
    }

    // ── Primary admin ─────────────────────────────────────────────────────────

    private static function ensurePrimaryAdmin(): void
    {
        $env = fn(string $k, string $d = '') => (string) ($_ENV[$k] ?? getenv($k) ?: $d);

        $email    = strtolower(trim($env('PRIMARY_ADMIN_EMAIL')));
        $password = $env('PRIMARY_ADMIN_PASSWORD');
        if (!$email || !$password) {
            error_log('[AFV] No primary admin bootstrap configured. Set PRIMARY_ADMIN_EMAIL and PRIMARY_ADMIN_PASSWORD to create one automatically.');
            return;
        }

        $name      = trim($env('PRIMARY_ADMIN_NAME', 'Main Admin')) ?: 'Main Admin';
        $vatsimCid = trim($env('PRIMARY_ADMIN_VATSIM_CID')) ?: null;
        $hours     = (float) $env('PRIMARY_ADMIN_FLIGHT_HOURS', '0');
        $points    = (int)   $env('PRIMARY_ADMIN_POINTS', '0');

        $hash = (str_starts_with($password, '$2')) ? $password : password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

        self::$pdo->exec("UPDATE users SET is_primary_admin = 0 WHERE is_primary_admin <> 0");

        $stmt = self::$pdo->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1");
        $stmt->execute([$email]);
        $existing = $stmt->fetch();

        if ($existing) {
            $upd = self::$pdo->prepare("UPDATE users SET name = ?, password = ?, vatsim_cid = ?, role = 'admin', is_primary_admin = 1 WHERE id = ?");
            $upd->execute([$name, $hash, $vatsimCid, $existing['id']]);
        } else {
            $ins = self::$pdo->prepare(
                "INSERT INTO users (name, email, password, vatsim_cid, role, is_primary_admin, created_by_user_id, joined_at, flight_hours, points)
                 VALUES (?, ?, ?, ?, 'admin', 1, NULL, '2020-03-01 00:00:00', ?, ?)"
            );
            $ins->execute([$name, $email, $hash, $vatsimCid, $hours, $points]);
        }
    }

    // ── Seeders ───────────────────────────────────────────────────────────────

    private static function seedAircraft(): void
    {
        $count = (int) self::$pdo->query("SELECT COUNT(*) FROM aircraft")->fetchColumn();
        if ($count > 0) return;

        $dataFile = defined('PROJECT_ROOT')
            ? PROJECT_ROOT . '/backend-php/src/data/aircraft.json'
            : dirname(__DIR__) . '/data/aircraft.json';

        if (!file_exists($dataFile)) return;
        $aircraft = json_decode((string) file_get_contents($dataFile), true);
        if (!is_array($aircraft)) return;

        $stmt = self::$pdo->prepare(
            "INSERT INTO aircraft (registration, type, category, hub, hub_name, economy_seats, business_seats, first_seats, range_km, cruise_speed_kmh, status, image, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        foreach ($aircraft as $a) {
            $stmt->execute([
                $a['registration'], $a['type'], $a['category'],
                $a['hub'], $a['hub_name'],
                $a['seats']['economy']  ?? 0,
                $a['seats']['business'] ?? 0,
                $a['seats']['first']    ?? 0,
                $a['range_km']          ?? 0,
                $a['cruise_speed_kmh']  ?? 0,
                $a['status']            ?? 'active',
                $a['image']             ?? null,
                $a['description']       ?? null,
            ]);
        }
    }

    private static function ensureAircraftImages(): void
    {
        $outdated = (int) self::$pdo->query(
            "SELECT COUNT(*) FROM aircraft WHERE image IS NULL OR image NOT LIKE '/assets/%'"
        )->fetchColumn();
        if ($outdated === 0) return;

        $dataFile = defined('PROJECT_ROOT')
            ? PROJECT_ROOT . '/backend-php/src/data/aircraft.json'
            : dirname(__DIR__) . '/data/aircraft.json';

        if (!file_exists($dataFile)) return;
        $aircraft = json_decode((string) file_get_contents($dataFile), true);
        if (!is_array($aircraft)) return;

        $stmt = self::$pdo->prepare(
            "UPDATE aircraft SET image = ? WHERE registration = ? AND (image IS NULL OR image NOT LIKE '/assets/%')"
        );
        foreach ($aircraft as $a) {
            if (!empty($a['image'])) {
                $stmt->execute([$a['image'], $a['registration']]);
            }
        }
        error_log('[AFV] Updated ' . $outdated . ' aircraft images to local paths.');
    }

    private static function seedAirports(): void
    {
        $count = (int) self::$pdo->query("SELECT COUNT(*) FROM airports")->fetchColumn();
        if ($count > 0) return;

        $dataFile = defined('PROJECT_ROOT')
            ? PROJECT_ROOT . '/backend-php/src/data/airports.json'
            : dirname(__DIR__) . '/data/airports.json';

        if (!file_exists($dataFile)) return;
        $airports = json_decode((string) file_get_contents($dataFile), true);
        if (!is_array($airports)) return;

        $stmt = self::$pdo->prepare(
            "INSERT INTO airports (icao, iata, name, city, country, lat, lon, hub) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        foreach ($airports as $icao => $ap) {
            $stmt->execute([
                $icao, $ap['iata'] ?? null, $ap['name'], $ap['city'], $ap['country'],
                $ap['lat'], $ap['lon'], !empty($ap['hub']) ? 1 : 0,
            ]);
        }
        error_log('[AFV] Seeded ' . count($airports) . ' airports.');
    }

    private static function seedRoutesAndSchedules(): void
    {
        $routeCount    = (int) self::$pdo->query("SELECT COUNT(*) FROM routes")->fetchColumn();
        $scheduleCount = (int) self::$pdo->query("SELECT COUNT(*) FROM route_schedules")->fetchColumn();

        $routes         = FlightNetwork::getRoutes();
        $dailySchedules = FlightNetwork::getDailySchedules();

        $expectedRoutes    = count($routes);
        $expectedSchedules = $expectedRoutes * count($dailySchedules);

        if ($routeCount === $expectedRoutes && $scheduleCount >= $expectedSchedules) return;

        error_log("[AFV] Seeding routes and schedules (DB routes: {$routeCount}, schedules: {$scheduleCount} → expected {$expectedRoutes}/{$expectedSchedules})…");

        self::$pdo->exec("DELETE FROM route_schedules");
        self::$pdo->exec("DELETE FROM routes");
        self::$pdo->exec("ALTER TABLE routes AUTO_INCREMENT = 1");
        self::$pdo->exec("ALTER TABLE route_schedules AUTO_INCREMENT = 1");

        $airportRows = self::$pdo->query("SELECT icao, lat, lon FROM airports")->fetchAll();
        $airportMap  = [];
        foreach ($airportRows as $r) {
            $airportMap[$r['icao']] = ['lat' => (float) $r['lat'], 'lon' => (float) $r['lon']];
        }

        $aircraftRows = self::$pdo->query("SELECT id, registration, category, hub, range_km FROM aircraft ORDER BY id ASC")->fetchAll();

        $routeStmt = self::$pdo->prepare(
            "INSERT INTO routes (from_airport, to_airport, hub_airport, distance_km, duration_minutes, aircraft_id, status)
             VALUES (?, ?, ?, ?, ?, ?, 'active')"
        );
        $schedStmt = self::$pdo->prepare(
            "INSERT INTO route_schedules (route_id, flight_number, slot_code, departure_time, active) VALUES (?, ?, ?, ?, 1)"
        );

        $suffixes = ['', 'B', 'C'];
        foreach ($routes as $route) {
            $origin = $airportMap[$route['from']] ?? null;
            $dest   = $airportMap[$route['to']]   ?? null;
            if (!$origin || !$dest) {
                error_log("[AFV] Skipping route {$route['flightNumber']}: unknown airport {$route['from']} or {$route['to']}");
                continue;
            }

            $distanceKm      = DistanceHelper::haversineDistance($origin['lat'], $origin['lon'], $dest['lat'], $dest['lon']);
            $durationMinutes = DistanceHelper::estimateDurationMinutes($distanceKm);
            $aircraftId      = self::selectAircraftId($aircraftRows, $route['hub'], $distanceKm);

            $routeStmt->execute([$route['from'], $route['to'], $route['hub'], $distanceKm, $durationMinutes, $aircraftId]);
            $routeId = (int) self::$pdo->lastInsertId();

            foreach ($dailySchedules as $i => $slot) {
                $fn = $route['flightNumber'] . $suffixes[$i];
                $schedStmt->execute([$routeId, $fn, $slot['slotCode'], $slot['departureTime']]);
            }
        }

        error_log('[AFV] Seeded ' . count($routes) . ' routes with schedules.');
    }

    private static function selectAircraftId(array $aircraftRows, string $hubAirport, int $distanceKm): ?int
    {
        $category = DistanceHelper::routeCategory($distanceKm);
        $byHub    = array_filter($aircraftRows, fn($a) => $a['hub'] === $hubAirport);
        $byCat    = array_filter($byHub, fn($a) => $a['category'] === $category);

        if ($byCat) return (int) reset($byCat)['id'];
        if ($byHub) return (int) reset($byHub)['id'];

        $anyCategory = array_filter($aircraftRows, fn($a) => $a['category'] === $category);
        if ($anyCategory) return (int) reset($anyCategory)['id'];

        return $aircraftRows ? (int) $aircraftRows[0]['id'] : null;
    }

    private static function seedAirlineStats(): void
    {
        $count = (int) self::$pdo->query("SELECT COUNT(*) FROM airline_stats")->fetchColumn();
        if ($count > 0) return;

        $stats = FlightNetwork::getAirlineStats();
        $stmt  = self::$pdo->prepare(
            "INSERT INTO airline_stats (total_flights, total_hours, active_members, founded_date, first_flight_from, first_flight_to, first_flight_date, division, callsign_prefix)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $stats['totalFlights'], $stats['totalHours'], $stats['activeMembers'],
            $stats['foundedDate'],  $stats['firstFlightFrom'], $stats['firstFlightTo'],
            $stats['firstFlightDate'], $stats['division'], $stats['callsignPrefix'],
        ]);
        error_log('[AFV] Seeded airline stats.');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static function parseJsonSeed(mixed $value, mixed $fallback): mixed
    {
        if ($value === null) return $fallback;
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            return (json_last_error() === JSON_ERROR_NONE) ? $decoded : $fallback;
        }
        return $value;
    }

    private static function normalizeSeedDT(?string $value, string $fallbackDate): string
    {
        if ($value) return str_replace(['T', 'Z'], [' ', ''], $value);
        return "{$fallbackDate} 00:00:00";
    }
}

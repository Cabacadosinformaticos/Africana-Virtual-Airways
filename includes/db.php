<?php
declare(strict_types=1);

// ── Bootstrap .env ────────────────────────────────────────────────────────────

(function () {
    $file = dirname(__DIR__) . '/.env';
    if (!file_exists($file)) return;
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k); $v = trim($v);
        if (getenv($k) === false) putenv("{$k}={$v}");
        $_ENV[$k]    ??= $v;
        $_SERVER[$k] ??= $v;
    }
})();

define('PROJECT_ROOT', dirname(__DIR__));

require_once __DIR__ . '/flight_network.php';

// ── Connection ────────────────────────────────────────────────────────────────

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) $pdo = _db_boot();
    return $pdo;
}

function _db_boot(): PDO {
    $host = getenv('DB_HOST') ?: '127.0.0.1';
    $port = (int) (getenv('DB_PORT') ?: 3306);
    $user = getenv('DB_USER') ?: 'root';
    $pass = getenv('DB_PASSWORD') ?: '';
    $name = getenv('DB_NAME') ?: 'afv_booking';

    $admin = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $admin->exec("CREATE DATABASE IF NOT EXISTS `{$name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $admin = null;

    $pdo = new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);

    _db_schema($pdo);
    _db_migrate($pdo);
    _db_backfill($pdo);
    _db_admin($pdo);
    _db_seed_aircraft($pdo);
    _db_seed_aircraft_images($pdo);
    _db_seed_airports($pdo);
    _db_seed_routes($pdo);
    _db_seed_stats($pdo);

    return $pdo;
}

// ── Schema ────────────────────────────────────────────────────────────────────

function _db_schema(PDO $pdo): void {
    $path = PROJECT_ROOT . '/database/mysql.sql';
    if (!file_exists($path)) return;
    $sql  = (string) file_get_contents($path);
    foreach (array_filter(array_map('trim', preg_split('/;\s*(\r?\n|$)/', $sql))) as $stmt) {
        $pdo->exec($stmt);
    }
}

function _db_migrate(PDO $pdo): void {
    _db_ensure_col($pdo, 'users', 'is_primary_admin', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER role');
    _db_ensure_col($pdo, 'users', 'created_by_user_id', 'INT NULL AFTER is_primary_admin');
    _db_ensure_idx($pdo, 'users', 'idx_users_created_by', 'ALTER TABLE users ADD INDEX idx_users_created_by (created_by_user_id)');
}

function _db_ensure_col(PDO $pdo, string $table, string $col, string $def): void {
    $stmt = $pdo->query("SHOW COLUMNS FROM `{$table}` LIKE '{$col}'");
    if (!$stmt->fetch()) $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$col}` {$def}");
}

function _db_ensure_idx(PDO $pdo, string $table, string $idx, string $sql): void {
    $stmt = $pdo->query("SHOW INDEX FROM `{$table}` WHERE Key_name = '{$idx}'");
    if (!$stmt->fetch()) $pdo->exec($sql);
}

// ── Backfill booking children ─────────────────────────────────────────────────

function _db_backfill(PDO $pdo): void {
    $rows = $pdo->query(
        "SELECT b.id, b.booking_ref, b.seat_selection, b.passenger_details, b.itinerary,
                COALESCE(bp.pc,0) AS pc, COALESCE(bs.sc,0) AS sc
         FROM bookings b
         LEFT JOIN (SELECT booking_id, COUNT(*) AS pc FROM booking_passengers GROUP BY booking_id) bp ON bp.booking_id = b.id
         LEFT JOIN (SELECT booking_id, COUNT(*) AS sc FROM booking_segments GROUP BY booking_id) bs ON bs.booking_id = b.id
         WHERE COALESCE(bp.pc,0)=0 OR COALESCE(bs.sc,0)=0"
    )->fetchAll();
    if (!$rows) return;

    $pdo->beginTransaction();
    try {
        foreach ($rows as $row) {
            $passengers = _db_parse_json($row['passenger_details'], []);
            $itinerary  = _db_parse_json($row['itinerary'], ['segments' => []]);
            $segments   = $itinerary['segments'] ?? [];

            if ((int) $row['pc'] === 0) {
                $s = $pdo->prepare("INSERT INTO booking_passengers (booking_id,passenger_index,first_name,last_name,email,phone,nationality,seat_selection) VALUES (?,?,?,?,?,?,?,?)");
                foreach ($passengers as $i => $p) {
                    $s->execute([$row['id'],$i,trim((string)($p['firstName']??'')),trim((string)($p['lastName']??'')),
                        strtolower(trim((string)($p['email']??''))),
                        !empty($p['phone'])?trim((string)$p['phone']):null,
                        !empty($p['nationality'])?trim((string)$p['nationality']):null,
                        $p['seat']??($i===0?($row['seat_selection']??null):null)]);
                }
            }

            if ((int) $row['sc'] === 0) {
                $s = $pdo->prepare("INSERT INTO booking_segments (booking_id,segment_index,route_id,flight_number,from_airport,to_airport,departure_date,arrival_date,departure_time,arrival_time,departure_datetime,arrival_datetime,duration_minutes,distance_km,aircraft_id,aircraft_registration,aircraft_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
                foreach ($segments as $i => $seg) {
                    $s->execute([$row['id'],$i,$seg['routeId']??null,$seg['flightNumber'],$seg['from'],$seg['to'],
                        $seg['departureDate'],$seg['arrivalDate']??$seg['departureDate'],$seg['departure']??'',$seg['arrival']??'',
                        _db_norm_dt($seg['departureDateTime']??null,$seg['departureDate']),
                        _db_norm_dt($seg['arrivalDateTime']??null,$seg['arrivalDate']??$seg['departureDate']),
                        $seg['durationMinutes']??0,$seg['distanceKm']??0,
                        $seg['aircraft']['id']??null,$seg['aircraft']['registration']??null,$seg['aircraft']['type']??null]);
                }
            }
        }
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
}

// ── Primary admin ─────────────────────────────────────────────────────────────

function _db_admin(PDO $pdo): void {
    $email = strtolower(trim((string)(getenv('PRIMARY_ADMIN_EMAIL') ?: '')));
    $pass  = (string)(getenv('PRIMARY_ADMIN_PASSWORD') ?: '');
    if (!$email || !$pass) return;

    $name      = trim((string)(getenv('PRIMARY_ADMIN_NAME') ?: 'Main Admin')) ?: 'Main Admin';
    $vatsimCid = trim((string)(getenv('PRIMARY_ADMIN_VATSIM_CID') ?: '')) ?: null;
    $hours     = (float)(getenv('PRIMARY_ADMIN_FLIGHT_HOURS') ?: 0);
    $points    = (int)(getenv('PRIMARY_ADMIN_POINTS') ?: 0);
    $hash      = str_starts_with($pass, '$2') ? $pass : password_hash($pass, PASSWORD_BCRYPT, ['cost' => 10]);

    $pdo->exec("UPDATE users SET is_primary_admin=0 WHERE is_primary_admin<>0");
    $stmt = $pdo->prepare("SELECT id FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1");
    $stmt->execute([$email]);
    $existing = $stmt->fetch();

    if ($existing) {
        $pdo->prepare("UPDATE users SET name=?,password=?,vatsim_cid=?,role='admin',is_primary_admin=1 WHERE id=?")
            ->execute([$name, $hash, $vatsimCid, $existing['id']]);
    } else {
        $pdo->prepare("INSERT INTO users (name,email,password,vatsim_cid,role,is_primary_admin,created_by_user_id,joined_at,flight_hours,points) VALUES (?,?,?,?,'admin',1,NULL,'2020-03-01 00:00:00',?,?)")
            ->execute([$name, $email, $hash, $vatsimCid, $hours, $points]);
    }
}

// ── Seeders ───────────────────────────────────────────────────────────────────

function _db_seed_aircraft(PDO $pdo): void {
    if ((int)$pdo->query("SELECT COUNT(*) FROM aircraft")->fetchColumn() > 0) return;
    $file = PROJECT_ROOT . '/data/aircraft.json';
    if (!file_exists($file)) return;
    $list = json_decode((string)file_get_contents($file), true);
    if (!is_array($list)) return;
    $s = $pdo->prepare("INSERT INTO aircraft (registration,type,category,hub,hub_name,economy_seats,business_seats,first_seats,range_km,cruise_speed_kmh,status,image,description) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
    foreach ($list as $a) {
        $s->execute([$a['registration'],$a['type'],$a['category'],$a['hub'],$a['hub_name'],
            $a['seats']['economy']??0,$a['seats']['business']??0,$a['seats']['first']??0,
            $a['range_km']??0,$a['cruise_speed_kmh']??0,$a['status']??'active',$a['image']??null,$a['description']??null]);
    }
}

function _db_seed_aircraft_images(PDO $pdo): void {
    $outdated = (int)$pdo->query("SELECT COUNT(*) FROM aircraft WHERE image IS NULL OR image NOT LIKE '/assets/%'")->fetchColumn();
    if ($outdated === 0) return;
    $file = PROJECT_ROOT . '/data/aircraft.json';
    if (!file_exists($file)) return;
    $list = json_decode((string)file_get_contents($file), true);
    if (!is_array($list)) return;
    $s = $pdo->prepare("UPDATE aircraft SET image=? WHERE registration=? AND (image IS NULL OR image NOT LIKE '/assets/%')");
    foreach ($list as $a) {
        if (!empty($a['image'])) $s->execute([$a['image'], $a['registration']]);
    }
}

function _db_seed_airports(PDO $pdo): void {
    if ((int)$pdo->query("SELECT COUNT(*) FROM airports")->fetchColumn() > 0) return;
    $file = PROJECT_ROOT . '/data/airports.json';
    if (!file_exists($file)) return;
    $list = json_decode((string)file_get_contents($file), true);
    if (!is_array($list)) return;
    $s = $pdo->prepare("INSERT INTO airports (icao,iata,name,city,country,lat,lon,hub) VALUES (?,?,?,?,?,?,?,?)");
    foreach ($list as $icao => $ap) {
        $s->execute([$icao,$ap['iata']??null,$ap['name'],$ap['city'],$ap['country'],$ap['lat'],$ap['lon'],!empty($ap['hub'])?1:0]);
    }
}

function _db_seed_routes(PDO $pdo): void {
    $routes    = fn_get_routes();
    $schedules = fn_get_schedules();

    $routeCount  = (int)$pdo->query("SELECT COUNT(*) FROM routes")->fetchColumn();
    $schedCount  = (int)$pdo->query("SELECT COUNT(*) FROM route_schedules")->fetchColumn();
    $expRoutes   = count($routes);
    $expSchedules = $expRoutes * count($schedules);

    if ($routeCount === $expRoutes && $schedCount >= $expSchedules) return;

    $pdo->exec("DELETE FROM route_schedules");
    $pdo->exec("DELETE FROM routes");
    $pdo->exec("ALTER TABLE routes AUTO_INCREMENT=1");
    $pdo->exec("ALTER TABLE route_schedules AUTO_INCREMENT=1");

    $airports = [];
    foreach ($pdo->query("SELECT icao,lat,lon FROM airports")->fetchAll() as $r) {
        $airports[$r['icao']] = ['lat' => (float)$r['lat'], 'lon' => (float)$r['lon']];
    }

    $aircraft = $pdo->query("SELECT id,registration,category,hub,range_km FROM aircraft ORDER BY id ASC")->fetchAll();

    $rStmt = $pdo->prepare("INSERT INTO routes (from_airport,to_airport,hub_airport,distance_km,duration_minutes,aircraft_id,status) VALUES (?,?,?,?,?,?,'active')");
    $sStmt = $pdo->prepare("INSERT INTO route_schedules (route_id,flight_number,slot_code,departure_time,active) VALUES (?,?,?,?,1)");
    $suffixes = ['', 'B', 'C'];

    foreach ($routes as $route) {
        $orig = $airports[$route['from']] ?? null;
        $dest = $airports[$route['to']]   ?? null;
        if (!$orig || !$dest) continue;

        $distKm  = _db_haversine($orig['lat'], $orig['lon'], $dest['lat'], $dest['lon']);
        $durMins = _db_est_duration($distKm);
        $aircraftId = _db_pick_aircraft($aircraft, $route['hub'], $distKm);

        $rStmt->execute([$route['from'], $route['to'], $route['hub'], $distKm, $durMins, $aircraftId]);
        $routeId = (int)$pdo->lastInsertId();

        foreach ($schedules as $i => $slot) {
            $sStmt->execute([$routeId, $route['flightNumber'] . $suffixes[$i], $slot['slotCode'], $slot['departureTime']]);
        }
    }
}

function _db_seed_stats(PDO $pdo): void {
    if ((int)$pdo->query("SELECT COUNT(*) FROM airline_stats")->fetchColumn() > 0) return;
    $s = fn_get_stats();
    $pdo->prepare("INSERT INTO airline_stats (total_flights,total_hours,active_members,founded_date,first_flight_from,first_flight_to,first_flight_date,division,callsign_prefix) VALUES (?,?,?,?,?,?,?,?,?)")
        ->execute([$s['totalFlights'],$s['totalHours'],$s['activeMembers'],$s['foundedDate'],$s['firstFlightFrom'],$s['firstFlightTo'],$s['firstFlightDate'],$s['division'],$s['callsignPrefix']]);
}

// ── Seeding helpers ───────────────────────────────────────────────────────────

function _db_haversine(float $lat1, float $lon1, float $lat2, float $lon2): int {
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a = sin($dLat/2)**2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon/2)**2;
    return (int)round(6371 * 2 * atan2(sqrt($a), sqrt(1-$a)));
}

function _db_est_duration(int $km): int {
    return (int)round(($km / 820) * 60) + ($km < 1000 ? 45 : 30);
}

function _db_pick_aircraft(array $aircraft, string $hub, int $km): ?int {
    $cat   = $km < 1500 ? 'Regional' : ($km < 5000 ? 'Short Range' : 'Long Range');
    $byHub = array_filter($aircraft, fn($a) => $a['hub'] === $hub);
    $byCat = array_filter($byHub,    fn($a) => $a['category'] === $cat);
    if ($byCat) return (int)reset($byCat)['id'];
    if ($byHub) return (int)reset($byHub)['id'];
    $anyCat = array_filter($aircraft, fn($a) => $a['category'] === $cat);
    if ($anyCat) return (int)reset($anyCat)['id'];
    return $aircraft ? (int)$aircraft[0]['id'] : null;
}

function _db_parse_json(mixed $v, mixed $fallback): mixed {
    if ($v === null) return $fallback;
    if (is_string($v)) { $d = json_decode($v, true); return json_last_error()===JSON_ERROR_NONE ? $d : $fallback; }
    return $v;
}

function _db_norm_dt(?string $v, string $fallback): string {
    if ($v) return str_replace(['T','Z'], [' ',''], $v);
    return "{$fallback} 00:00:00";
}

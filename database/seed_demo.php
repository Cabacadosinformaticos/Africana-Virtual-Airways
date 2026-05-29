<?php
declare(strict_types=1);

/**
 * Demo data seeder — inserts ~200 users and ~450 bookings.
 * Run once from the project root:  php database/seed_demo.php
 */

require_once __DIR__ . '/../includes/db.php';

$pdo = db();

// ── Guard ──────────────────────────────────────────────────────────────────────
$existing = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE is_primary_admin = 0")->fetchColumn();
if ($existing >= 50) {
    echo "Already have {$existing} non-admin users — skipping demo seed.\n";
    exit(0);
}

echo "Seeding demo data...\n";

$hash = password_hash('Password123!', PASSWORD_BCRYPT, ['cost' => 10]);

// ── Name / nationality pools ───────────────────────────────────────────────────
$firstNames = [
    'Amina','Bongani','Celeste','Damilola','Emeka','Fatima','Grace','Hassan','Imani','Jabari',
    'Kadiatu','Léa','Mandla','Nadia','Obinna','Priya','Rania','Sipho','Taiwo','Ugo',
    'Valentina','Wanjiru','Xolani','Yusuf','Zara','Aiko','Carlos','Diana','Eduardo','Francesca',
    'Giovanni','Hana','Ivan','Joana','Kenji','Luca','Mia','Nikolaj','Olivia','Paulo',
    'Rafael','Sofia','Thibault','Viktor','Wren','Yasmin','Zineb','Abebe','Bethel','Chidi',
    'Desta','Eyob','Femi','Gifty','Hamid','Isata','Jomo','Kwame','Leila','Mamadou',
    'Nia','Omar','Pendo','Rashid','Salma','Tunde','Uwem','Vera','William','Yemi',
    'Zanele','André','Beatriz','Cláudio','Daniela','Estela','Felipe','Gabriela','Henrique','Inês',
    'Joaquim','Luísa','Marco','Nuno','Pedro','Renata','Sónia','Tomás','Xavier','Yvonne',
    'Abou','Bintu','Cheikh','Djeneba','Esi','Fatou','Gaoussou','Hawa','Ibrahima','Jeneba',
];

$lastNames = [
    'Okafor','Mendes','Dlamini','Andrade','Mensah','Oliveira','Nkosi','Santos','Diallo','Ferreira',
    'Banda','Costa','Mwangi','Alves','Ndlovu','Soares','Abebe','Lima','Sow','Rodrigues',
    'Kamara','Martins','Phiri','Carvalho','Traore','Barbosa','Osei','Gomes','Diop','Nunes',
    'Amara','Pinto','Mutua','Ribeiro','Coulibaly','Cunha','Ngozi','Fonseca','Keita','Pereira',
    'Balogun','Teixeira','Achebe','Lopes','Eze','Azevedo','Jallow','Moreira','Bakayoko','Araújo',
    'Asante','Cruz','Adeyemi','Machado','Nwosu','Fernandes','Agyemang','Vieira','Sesay','Pires',
    'Owusu','Ramos','Chukwu','Dias','Abubakar','Correia','Sarpong','Cardoso','Branco','Marques',
    'Faria','Melo','Ibrahim','Freitas','Bah','Koné','Ojo','Nkrumah','Toure','Balde',
    'Cissé','Diallo','Sylla','Barry','Camara','Dieng','Fall','Gaye','Ndiaye','Wade',
];

$nationalities = [
    'Mozambican','Mozambican','South African','South African','Angolan','Algerian','Algerian',
    'Moroccan','Tunisian','Kenyan','Nigerian','Nigerian','Ghanaian','Senegalese','Portuguese',
    'Portuguese','French','Spanish','Italian','German','British','American','Brazilian','Canadian',
    'Australian','Emirati','Japanese','Chinese','Namibian','Zimbabwean','Zambian','Tanzanian',
];

// ── Load routes from DB ────────────────────────────────────────────────────────
$routes = $pdo->query("
    SELECT r.id, r.from_airport, r.to_airport, r.distance_km, r.duration_minutes,
           a.id AS aircraft_id, a.registration, a.type AS aircraft_type,
           rs.flight_number, rs.departure_time
    FROM routes r
    JOIN route_schedules rs ON rs.route_id = r.id AND rs.slot_code = 'morning'
    LEFT JOIN aircraft a ON a.id = r.aircraft_id
    WHERE r.status = 'active'
")->fetchAll();

if (empty($routes)) {
    echo "No active routes found. Boot the app first to seed routes, then run this script.\n";
    exit(1);
}

$shortRoutes  = array_values(array_filter($routes, fn($r) => $r['distance_km'] < 1500));
$mediumRoutes = array_values(array_filter($routes, fn($r) => $r['distance_km'] >= 1500 && $r['distance_km'] < 5000));
$longRoutes   = array_values(array_filter($routes, fn($r) => $r['distance_km'] >= 5000));

// ── Helper functions ───────────────────────────────────────────────────────────

function _rand(array $arr): mixed {
    return $arr[array_rand($arr)];
}

function _pick_route(array $s, array $m, array $l): array {
    $r = random_int(1, 100);
    if ($r <= 45 && $s) return _rand($s);
    if ($r <= 75 && $m) return _rand($m);
    if ($l)             return _rand($l);
    return _rand(array_merge($s, $m, $l));
}

function _pick_cabin(): string {
    $r = random_int(1, 100);
    if ($r <= 65) return 'economy';
    if ($r <= 88) return 'business';
    return 'first';
}

function _pick_status(string $travelDate): string {
    if (strtotime($travelDate) > time()) return 'confirmed';
    return match (true) {
        random_int(1, 100) <= 45 => 'on_time',
        random_int(1, 100) <= 65 => 'confirmed',
        random_int(1, 100) <= 82 => 'delayed',
        default                  => 'cancelled',
    };
}

function _price(int $km, string $cabin): float {
    $base = match (true) {
        $km < 400  => random_int(65,  180),
        $km < 1000 => random_int(120, 350),
        $km < 2000 => random_int(240, 620),
        $km < 5000 => random_int(400, 1250),
        $km < 9000 => random_int(680, 2300),
        default    => random_int(900, 3600),
    };
    return (float)round(match ($cabin) {
        'business' => $base * (random_int(22, 32) / 10),
        'first'    => $base * (random_int(42, 62) / 10),
        default    => $base * (1 + random_int(0, 22) / 100),
    }, 2);
}

function _arr_time(string $dep, int $mins): string {
    return date('H:i', strtotime("1970-01-01 {$dep}") + $mins * 60);
}

function _make_ref(array &$used): string {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    do {
        $ref = 'AFV';
        for ($i = 0; $i < 6; $i++) $ref .= $chars[random_int(0, strlen($chars) - 1)];
    } while (isset($used[$ref]));
    $used[$ref] = true;
    return $ref;
}

// ── Insert users ───────────────────────────────────────────────────────────────
$userStmt = $pdo->prepare("
    INSERT IGNORE INTO users (name, email, password, vatsim_cid, role, is_primary_admin, created_by_user_id, joined_at, flight_hours, points)
    VALUES (?, ?, ?, ?, 'user', 0, NULL, ?, ?, ?)
");

$users      = [];
$usedEmails = [];

for ($i = 0; $i < 200; $i++) {
    $first = _rand($firstNames);
    $last  = _rand($lastNames);

    $base  = strtolower(preg_replace('/[^a-z0-9]/i', '', $first) . '.' . preg_replace('/[^a-z0-9]/i', '', $last));
    $email = "{$base}@afv-demo.va";
    $n = 1;
    while (isset($usedEmails[$email])) { $email = "{$base}{$n}@afv-demo.va"; $n++; }
    $usedEmails[$email] = true;

    // Growth curve: more recent registrations are more common
    $slot    = random_int(1, 100);
    $daysAgo = match (true) {
        $slot <= 35 => random_int(0,   90),   // 35% last 3 months
        $slot <= 65 => random_int(91,  270),  // 30% 3-9 months ago
        default     => random_int(271, 540),  // 35% 9-18 months ago
    };
    $joinedAt  = date('Y-m-d H:i:s', time() - $daysAgo * 86400 + random_int(0, 86400));
    $vatsimCid = random_int(1, 100) <= 28 ? (string)random_int(1100000, 1599999) : null;
    $hours     = random_int(0, 960);
    $points    = (int)($hours * random_int(8, 16));

    $userStmt->execute([$first . ' ' . $last, $email, $hash, $vatsimCid, $joinedAt, $hours, $points]);
    $uid = (int)$pdo->lastInsertId();
    if ($uid === 0) continue; // duplicate ignored

    $users[] = [
        'id'          => $uid,
        'name'        => $first . ' ' . $last,
        'first'       => $first,
        'last'        => $last,
        'email'       => $email,
        'joined_ts'   => strtotime($joinedAt),
        'nationality' => _rand($nationalities),
    ];
}

echo count($users) . " users inserted.\n";

// ── Insert bookings ────────────────────────────────────────────────────────────
$bookStmt = $pdo->prepare("
    INSERT INTO bookings (booking_ref, user_id, user_name, passenger_email, flight_number,
        from_airport, to_airport, travel_date, cabin_class, passengers, total_price, status,
        seat_selection, passenger_details, itinerary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, NULL, ?, ?, ?)
");
$paxStmt = $pdo->prepare("
    INSERT INTO booking_passengers (booking_id, passenger_index, first_name, last_name,
        email, phone, nationality, seat_selection)
    VALUES (?, 0, ?, ?, ?, ?, ?, NULL)
");
$segStmt = $pdo->prepare("
    INSERT INTO booking_segments (booking_id, segment_index, route_id, flight_number,
        from_airport, to_airport, departure_date, arrival_date, departure_time, arrival_time,
        departure_datetime, arrival_datetime, duration_minutes, distance_km,
        aircraft_id, aircraft_registration, aircraft_type)
    VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
");

$usedRefs     = [];
$bookingCount = 0;
$nowTs        = time();

// Booking count per user distribution
$distribution = [0=>15, 1=>28, 2=>25, 3=>16, 4=>10, 5=>6]; // % → book count
$pool         = [];
foreach ($distribution as $n => $pct) {
    for ($k = 0; $k < $pct; $k++) $pool[] = $n;
}

$pdo->beginTransaction();
try {
    foreach ($users as $user) {
        $numBooks = $pool[array_rand($pool)];
        for ($b = 0; $b < $numBooks; $b++) {
            $route      = _pick_route($shortRoutes, $mediumRoutes, $longRoutes);
            $cabin      = _pick_cabin();
            $price      = _price((int)$route['distance_km'], $cabin);
            $createdTs  = random_int($user['joined_ts'], $nowTs);
            $createdAt  = date('Y-m-d H:i:s', $createdTs);

            // 80% future travel, 20% past
            $travelDate = random_int(1, 100) <= 20
                ? date('Y-m-d', $createdTs - random_int(1, 120) * 86400)
                : date('Y-m-d', $nowTs + random_int(7, 200) * 86400);

            $status  = _pick_status($travelDate);
            $ref     = _make_ref($usedRefs);
            $depTime = $route['departure_time'];
            $arrTime = _arr_time($depTime, (int)$route['duration_minutes']);

            $paxJson = json_encode([[
                'firstName'   => $user['first'],
                'lastName'    => $user['last'],
                'email'       => $user['email'],
                'phone'       => '+258' . random_int(820000000, 879999999),
                'nationality' => $user['nationality'],
                'seat'        => null,
            ]]);

            $itinJson = json_encode([
                'from'     => $route['from_airport'],
                'to'       => $route['to_airport'],
                'segments' => [[
                    'flightNumber'      => $route['flight_number'],
                    'from'              => $route['from_airport'],
                    'to'                => $route['to_airport'],
                    'routeId'           => $route['id'],
                    'departureDate'     => $travelDate,
                    'arrivalDate'       => $travelDate,
                    'departure'         => substr($depTime, 0, 5),
                    'arrival'           => $arrTime,
                    'departureDateTime' => $travelDate . 'T' . $depTime,
                    'arrivalDateTime'   => $travelDate . 'T' . $arrTime . ':00',
                    'durationMinutes'   => $route['duration_minutes'],
                    'distanceKm'        => $route['distance_km'],
                    'aircraft'          => $route['aircraft_id'] ? [
                        'id'           => (int)$route['aircraft_id'],
                        'registration' => $route['registration'],
                        'type'         => $route['aircraft_type'],
                    ] : null,
                ]],
            ]);

            $bookStmt->execute([
                $ref, $user['id'], $user['name'], $user['email'],
                $route['flight_number'], $route['from_airport'], $route['to_airport'],
                $travelDate, $cabin, $price, $status,
                $paxJson, $itinJson, $createdAt,
            ]);
            $bookingId = (int)$pdo->lastInsertId();

            $paxStmt->execute([
                $bookingId, $user['first'], $user['last'], $user['email'],
                '+258' . random_int(820000000, 879999999), $user['nationality'],
            ]);

            $segStmt->execute([
                $bookingId, $route['id'], $route['flight_number'],
                $route['from_airport'], $route['to_airport'],
                $travelDate, $travelDate,
                substr($depTime, 0, 5), $arrTime,
                $travelDate . ' ' . $depTime,
                $travelDate . ' ' . $arrTime . ':00',
                $route['duration_minutes'], $route['distance_km'],
                $route['aircraft_id'], $route['registration'], $route['aircraft_type'],
            ]);

            $bookingCount++;
        }
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}

echo "{$bookingCount} bookings inserted.\n";
echo "Done. Open the admin dashboard → Site Metrics to see the data.\n";

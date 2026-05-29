<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

cors_headers();
require_admin();

$method   = $_SERVER['REQUEST_METHOD'];
$path     = api_path('/api/admin');
$segments = $path ? explode('/', $path) : [];

// GET /api/admin/stats
if ($method === 'GET' && $path === 'stats') {
    $today    = date('Y-m-d');
    $bookings = db()->query("SELECT * FROM bookings ORDER BY created_at DESC")->fetchAll();
    $mapped   = array_map('map_booking', $bookings);
    $active   = array_filter($mapped, fn($b)=>$b['status']!=='cancelled');

    $byClass = ['economy'=>0.0,'business'=>0.0,'first'=>0.0];
    foreach ($active as $b) { $byClass[$b['cabinClass']] = ($byClass[$b['cabinClass']]??0.0) + $b['totalPrice']; }

    $routeCounts = [];
    foreach ($mapped as $b) { $k="{$b['from']}-{$b['to']}"; $routeCounts[$k]=($routeCounts[$k]??0)+1; }
    arsort($routeCounts);
    $topRoutes = array_map(fn($r,$c)=>['route'=>$r,'count'=>$c], array_keys(array_slice($routeCounts,0,5,true)), array_slice($routeCounts,0,5,true));

    json_ok([
        'totalBookings'     => count($mapped),
        'confirmedBookings' => count(array_filter($mapped, fn($b)=>$b['status']!=='cancelled')),
        'cancelledBookings' => count(array_filter($mapped, fn($b)=>$b['status']==='cancelled')),
        'delayedBookings'   => count(array_filter($mapped, fn($b)=>$b['status']==='delayed')),
        'todayBookings'     => count(array_filter($mapped, fn($b)=>str_starts_with((string)($b['createdAt']??''),$today))),
        'totalRevenue'      => array_sum(array_column(array_values($active),'totalPrice')),
        'totalUsers'        => (int)db()->query("SELECT COUNT(*) FROM users")->fetchColumn(),
        'activeFleet'       => (int)db()->query("SELECT COUNT(*) FROM aircraft WHERE status='active'")->fetchColumn(),
        'revenueByClass'    => $byClass,
        'topRoutes'         => array_values($topRoutes),
    ]);
}

// GET /api/admin/users
if ($method === 'GET' && $path === 'users') {
    $rows = db()->query("SELECT users.*,creators.name AS created_by_name FROM users LEFT JOIN users AS creators ON creators.id=users.created_by_user_id ORDER BY users.is_primary_admin DESC,users.joined_at DESC")->fetchAll();
    json_ok(array_map(fn($r)=>safe_user(map_user($r)), $rows));
}

// POST /api/admin/users
if ($method === 'POST' && $path === 'users') {
    $jwt   = auth_user();
    $actor = find_user_by_id((int)$jwt['id']);
    if (!$actor || !($actor['isPrimaryAdmin']??false)) json_err('Only the main admin can manage user logins.', 403);

    $body  = req_body();
    $name  = trim((string)($body['name']??''));
    $email = trim((string)($body['email']??''));
    $pass  = (string)($body['password']??'');
    $role  = strtolower(trim((string)($body['role']??'user')));
    $cid   = trim((string)($body['vatsimCid']??'')) ?: null;

    if (!$name||!$email||!$pass) json_err('name, email and password are required');
    if (!in_array($role,['admin','user'],true)) json_err('role must be admin or user');
    if (find_user_by_email($email)) json_err('Email already registered', 409);

    $hash = password_hash($pass, PASSWORD_BCRYPT, ['cost'=>10]);
    $s    = db()->prepare("INSERT INTO users (name,email,password,vatsim_cid,role,is_primary_admin,created_by_user_id,joined_at,flight_hours,points) VALUES (?,?,?,?,?,0,?,NOW(),0,0)");
    $s->execute([$name, strtolower($email), $hash, $cid, $role, $actor['id']]);
    json_ok(safe_user(find_user_by_id((int)db()->lastInsertId())), 201);
}

// PUT /api/admin/users/{id}/role
if ($method === 'PUT' && count($segments) === 3 && $segments[0]==='users' && $segments[2]==='role') {
    $jwt   = auth_user();
    $actor = find_user_by_id((int)$jwt['id']);
    if (!$actor||!($actor['isPrimaryAdmin']??false)) json_err('Only the main admin can manage user logins.', 403);

    $target = find_user_by_id((int)$segments[1]);
    if (!$target) json_err('User not found', 404);
    if ($target['isPrimaryAdmin']) json_err('The main admin role cannot be changed.');

    $role = strtolower(trim((string)(req_body()['role']??'user')));
    if (!in_array($role,['admin','user'],true)) json_err('role must be admin or user');
    db()->prepare("UPDATE users SET role=? WHERE id=?")->execute([$role,(int)$segments[1]]);
    json_ok(safe_user(find_user_by_id((int)$segments[1])));
}

// GET /api/admin/bookings
if ($method === 'GET' && $path === 'bookings') {
    $rows = db()->query("SELECT * FROM bookings ORDER BY created_at DESC")->fetchAll();
    json_ok(hydrate_bookings(array_map('map_booking', $rows)));
}

// PUT /api/admin/bookings/{ref}/status
if ($method === 'PUT' && count($segments)===3 && $segments[0]==='bookings' && $segments[2]==='status') {
    $status = (string)(req_body()['status']??'');
    if (!in_array($status,['confirmed','on_time','delayed','cancelled'],true)) json_err('Invalid status');

    $pdo = db(); $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE bookings SET status=?,cancelled_at=CASE WHEN ?='cancelled' THEN NOW() ELSE NULL END WHERE booking_ref=?")->execute([$status,$status,$segments[1]]);
        if ($status==='cancelled') $pdo->prepare("DELETE FROM booked_seats WHERE booking_ref=?")->execute([$segments[1]]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }

    $row = db()->prepare("SELECT * FROM bookings WHERE booking_ref=? LIMIT 1"); $row->execute([$segments[1]]);
    $b   = $row->fetch();
    if (!$b) json_err('Booking not found', 404);
    json_ok(hydrate_bookings([map_booking($b)])[0]);
}

// GET /api/admin/fleet
if ($method === 'GET' && $path === 'fleet') {
    $rows = db()->query("SELECT * FROM aircraft ORDER BY id ASC")->fetchAll();
    json_ok(array_map('map_aircraft', $rows));
}

// GET /api/admin/lookups
if ($method === 'GET' && $path === 'lookups') {
    $airports = array_values(get_airports());
    usort($airports, fn($a,$b)=>$a['hub']!==$b['hub']?($b['hub']<=>$a['hub']):(strcmp($a['city'],$b['city'])?: strcmp($a['icao'],$b['icao'])));
    $fleet = db()->query("SELECT * FROM aircraft ORDER BY id ASC")->fetchAll();
    $fleet = array_map('map_aircraft', $fleet);
    usort($fleet, fn($a,$b)=>$a['status']!==$b['status']?($a['status']==='active'?-1:1):strcmp($a['registration'],$b['registration']));
    json_ok(['airports'=>$airports,'aircraft'=>$fleet,'routeStatuses'=>['active','inactive']]);
}

// GET /api/admin/routes
if ($method === 'GET' && $path === 'routes') {
    $routes = get_routes_with_schedules();
    json_ok(['summary'=>['totalRoutes'=>count($routes),'activeRoutes'=>count(array_filter($routes,fn($r)=>$r['status']==='active')),'inactiveRoutes'=>count(array_filter($routes,fn($r)=>$r['status']!=='active')),'routesWithAircraft'=>count(array_filter($routes,fn($r)=>$r['aircraft']!==null)),'hubs'=>count(array_unique(array_column($routes,'hubAirport')))],'routes'=>$routes]);
}

// POST /api/admin/routes
if ($method === 'POST' && $path === 'routes') {
    try {
        $route = _admin_create_route(_admin_normalize_route(req_body()));
    } catch (RuntimeException $e) { json_err($e->getMessage(), $e->getCode()?:400); }
    json_ok($route, 201);
}

// PUT /api/admin/routes/{id}
if ($method === 'PUT' && count($segments)===2 && $segments[0]==='routes') {
    $routeId = (int)$segments[1];
    if (!$routeId) json_err('A valid route id is required.', 400);
    if (!get_route_by_id($routeId)) json_err('Route not found', 404);
    try {
        $route = _admin_update_route($routeId, _admin_normalize_route(req_body()));
    } catch (RuntimeException $e) { json_err($e->getMessage(), $e->getCode()?:400); }
    json_ok($route);
}

// GET /api/admin/airline-stats
if ($method === 'GET' && $path === 'airline-stats') {
    $row = db()->query("SELECT * FROM airline_stats LIMIT 1")->fetch();
    if (!$row) json_err('Airline stats not found', 404);
    json_ok(['totalFlights'=>$row['total_flights'],'totalHours'=>$row['total_hours'],'activeMembers'=>$row['active_members'],
        'foundedDate'=>$row['founded_date'],'firstFlight'=>['from'=>$row['first_flight_from'],'to'=>$row['first_flight_to'],'date'=>$row['first_flight_date']],
        'division'=>$row['division'],'callsignPrefix'=>$row['callsign_prefix'],'updatedAt'=>$row['updated_at']]);
}

// PUT /api/admin/airline-stats
if ($method === 'PUT' && $path === 'airline-stats') {
    $allowed = ['totalFlights'=>'total_flights','totalHours'=>'total_hours','activeMembers'=>'active_members','foundedDate'=>'founded_date','division'=>'division','callsignPrefix'=>'callsign_prefix'];
    $body    = req_body();
    $sets = []; $vals = [];
    foreach ($allowed as $key => $col) { if (array_key_exists($key,$body)) { $sets[]=$col.'=?'; $vals[]=$body[$key]; } }
    if (!$sets) json_err('No valid fields provided');
    db()->prepare("UPDATE airline_stats SET ".implode(',',$sets)." WHERE id=1")->execute($vals);
    $row = db()->query("SELECT * FROM airline_stats LIMIT 1")->fetch();
    json_ok(['totalFlights'=>$row['total_flights'],'totalHours'=>$row['total_hours'],'activeMembers'=>$row['active_members'],
        'foundedDate'=>$row['founded_date'],'firstFlight'=>['from'=>$row['first_flight_from'],'to'=>$row['first_flight_to'],'date'=>$row['first_flight_date']],
        'division'=>$row['division'],'callsignPrefix'=>$row['callsign_prefix'],'updatedAt'=>$row['updated_at']]);
}

// GET /api/admin/metrics
if ($method === 'GET' && $path === 'metrics') {
    $pdo = db();

    // ── Booking trend (last 12 months) ────────────────────────────────────────
    $bookingTimeline = $pdo->query("
        SELECT DATE_FORMAT(created_at,'%Y-%m') m, COUNT(*) n FROM bookings
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY m ORDER BY m
    ")->fetchAll();

    $userTimeline = $pdo->query("
        SELECT DATE_FORMAT(joined_at,'%Y-%m') m, COUNT(*) n FROM users
        WHERE joined_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        GROUP BY m ORDER BY m
    ")->fetchAll();

    // ── Cabin class distribution ──────────────────────────────────────────────
    $cabinRows = $pdo->query("SELECT cabin_class, COUNT(*) AS n FROM bookings GROUP BY cabin_class")->fetchAll();
    $cabinDist = []; foreach ($cabinRows as $r) $cabinDist[$r['cabin_class']] = (int)$r['n'];

    // ── Revenue by cabin class (economy = volume, business/first = value) ─────
    $revRows = $pdo->query("
        SELECT cabin_class, ROUND(SUM(total_price),2) AS rev, ROUND(AVG(total_price),2) AS avg
        FROM bookings WHERE status != 'cancelled' GROUP BY cabin_class
    ")->fetchAll();
    $revenueByClass = []; $avgByClass = [];
    foreach ($revRows as $r) {
        $revenueByClass[$r['cabin_class']] = (float)$r['rev'];
        $avgByClass[$r['cabin_class']]     = (float)$r['avg'];
    }

    // ── Top 8 routes by booking volume ───────────────────────────────────────
    $topRoutes = $pdo->query("
        SELECT CONCAT(from_airport,' → ',to_airport) AS route, COUNT(*) AS n
        FROM bookings GROUP BY from_airport, to_airport ORDER BY n DESC LIMIT 8
    ")->fetchAll();

    // ── Top 10 passenger nationalities ───────────────────────────────────────
    $nationalities = $pdo->query("
        SELECT nationality, COUNT(*) AS n FROM booking_passengers
        WHERE nationality IS NOT NULL AND nationality != ''
        GROUP BY nationality ORDER BY n DESC LIMIT 10
    ")->fetchAll();

    // ── Ticket price statistics ───────────────────────────────────────────────
    $prices = array_values(array_map('floatval',
        $pdo->query("SELECT total_price FROM bookings WHERE status!='cancelled' ORDER BY total_price ASC")->fetchAll(PDO::FETCH_COLUMN)
    ));
    $n  = count($prices);
    $ps = ['count'=>$n,'mean'=>0,'median'=>0,'mode'=>0,'stddev'=>0,'variance'=>0,'p10'=>0,'p25'=>0,'p75'=>0,'p90'=>0,'ci95Lower'=>0,'ci95Upper'=>0];
    if ($n > 0) {
        $mean = array_sum($prices) / $n;
        $sq   = array_sum(array_map(fn($p) => ($p - $mean) ** 2, $prices));
        $var  = $n > 1 ? $sq / ($n - 1) : 0.0;
        $std  = sqrt($var);
        $mid  = intdiv($n, 2);
        $med  = ($n % 2 === 0) ? ($prices[$mid - 1] + $prices[$mid]) / 2.0 : $prices[$mid];
        $freq = array_count_values(array_map(fn($p) => (string)(round($p / 100) * 100), $prices));
        arsort($freq); $mode = (float)array_key_first($freq);
        $ci   = $n > 1 ? 1.96 * $std / sqrt($n) : 0.0;
        $pct  = fn(float $q) => $prices[(int)floor($q * ($n - 1))];
        $ps   = ['count'=>$n,'mean'=>round($mean,2),'median'=>round($med,2),'mode'=>round($mode,2),
                 'stddev'=>round($std,2),'variance'=>round($var,2),
                 'p10'=>round($pct(0.10),2),'p25'=>round($pct(0.25),2),'p75'=>round($pct(0.75),2),'p90'=>round($pct(0.90),2),
                 'ci95Lower'=>round($mean - $ci, 2),'ci95Upper'=>round($mean + $ci, 2)];
    }

    // ── Price histogram ───────────────────────────────────────────────────────
    $hbins = [
        ['label'=>'< $500',    'min'=>0,    'max'=>500],
        ['label'=>'$500–$1k',  'min'=>500,  'max'=>1000],
        ['label'=>'$1k–$2k',   'min'=>1000, 'max'=>2000],
        ['label'=>'$2k–$3.5k', 'min'=>2000, 'max'=>3500],
        ['label'=>'> $3.5k',   'min'=>3500, 'max'=>999999],
    ];
    foreach ($hbins as &$b) {
        $s = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE status!='cancelled' AND total_price>=? AND total_price<?");
        $s->execute([$b['min'], $b['max']]); $b['count'] = (int)$s->fetchColumn();
        unset($b['min'], $b['max']);
    }
    unset($b);

    // ── Distance vs price (scatter) ───────────────────────────────────────────
    $scatter = $pdo->query("
        SELECT bs.distance_km x, b.total_price y FROM booking_segments bs
        JOIN bookings b ON b.id = bs.booking_id
        WHERE b.status != 'cancelled' AND bs.distance_km > 0 AND bs.segment_index = 0
        LIMIT 300
    ")->fetchAll();

    // ── Day-of-week × cabin class heatmap ────────────────────────────────────
    $dayRows = $pdo->query("SELECT DAYOFWEEK(created_at) dow, cabin_class, COUNT(*) n FROM bookings GROUP BY dow, cabin_class")->fetchAll();
    $hmap = [];
    foreach ($dayRows as $r) $hmap[(int)$r['dow']][$r['cabin_class']] = (int)$r['n'];

    // ── Booking lifecycle (operational pipeline) ──────────────────────────────
    $totalBookings  = (int)$pdo->query("SELECT COUNT(*) FROM bookings")->fetchColumn();
    $activeBookings = (int)$pdo->query("SELECT COUNT(*) FROM bookings WHERE status != 'cancelled'")->fetchColumn();
    $goodStatus     = (int)$pdo->query("SELECT COUNT(*) FROM bookings WHERE status IN ('confirmed','on_time')")->fetchColumn();
    $onTime         = (int)$pdo->query("SELECT COUNT(*) FROM bookings WHERE status = 'on_time'")->fetchColumn();

    // ── Essential KPIs ────────────────────────────────────────────────────────
    $active30        = (int)$pdo->query("SELECT COUNT(DISTINCT user_id) FROM bookings WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND user_id IS NOT NULL")->fetchColumn();
    $totalUsers      = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $bookers         = (int)$pdo->query("SELECT COUNT(DISTINCT user_id) FROM bookings WHERE user_id IS NOT NULL")->fetchColumn();
    $upcomingBooks   = (int)$pdo->query("SELECT COUNT(*) FROM bookings WHERE travel_date >= CURDATE() AND status != 'cancelled'")->fetchColumn();
    $cancelledCount  = (int)$pdo->query("SELECT COUNT(*) FROM bookings WHERE status = 'cancelled'")->fetchColumn();

    json_ok([
        'bookingTimeline'   => array_map(fn($r) => ['month'=>$r['m'], 'count'=>(int)$r['n']], $bookingTimeline),
        'userTimeline'      => array_map(fn($r) => ['month'=>$r['m'], 'count'=>(int)$r['n']], $userTimeline),
        'cabinDistribution' => $cabinDist,
        'revenueByClass'    => $revenueByClass,
        'avgPriceByClass'   => $avgByClass,
        'topRoutes'         => array_map(fn($r) => ['route'=>$r['route'], 'count'=>(int)$r['n']], $topRoutes),
        'nationalityTop10'  => array_map(fn($r) => ['label'=>$r['nationality'], 'count'=>(int)$r['n']], $nationalities),
        'priceStats'        => $ps,
        'priceHistogram'    => $hbins,
        'distancePrice'     => array_map(fn($r) => ['x'=>(int)$r['x'], 'y'=>(float)$r['y']], $scatter),
        'heatmap'           => $hmap,
        'bookingLifecycle'  => ['total'=>$totalBookings, 'active'=>$activeBookings, 'goodStatus'=>$goodStatus, 'onTime'=>$onTime],
        'essentialMetrics'  => [
            'upcomingBookings' => $upcomingBooks,
            'activeUsers30d'   => $active30,
            'conversionRate'   => $totalUsers > 0 ? round($bookers / $totalUsers * 100, 1) : 0,
            'cancellationRate' => $totalBookings > 0 ? round($cancelledCount / $totalBookings * 100, 1) : 0,
            'avgTicketPrice'   => $n > 0 ? round($ps['mean'], 0) : 0,
        ],
    ]);
}

json_err('Not found', 404);

// ── Route write helpers ────────────────────────────────────────────────────────

function _admin_normalize_route(array $body): array {
    $from = strtoupper(trim((string)($body['fromAirport']??$body['from']??'')));
    $to   = strtoupper(trim((string)($body['toAirport']??$body['to']??'')));
    $hub  = strtoupper(trim((string)($body['hubAirport']??$body['hub']??'')));
    $status = strtolower(trim((string)($body['status']??'active')));
    $aircraftId = ($body['aircraftId']===''||$body['aircraftId']===null) ? null : (int)($body['aircraftId']??null);

    $schedSrc = (isset($body['schedules'])&&is_array($body['schedules'])&&$body['schedules'])
        ? $body['schedules']
        : [['flightNumber'=>$body['flightNumber']??null,'slotCode'=>$body['slotCode']??null,'departureTime'=>$body['departureTime']??null,'active'=>$body['scheduleActive']??true]];
    $scheds = array_values(array_filter($schedSrc, fn($s)=>!empty($s['flightNumber'])||!empty($s['departureTime'])||!empty($s['slotCode'])));
    $scheds = array_map(fn($s,int $i)=>[
        'flightNumber' => strtoupper(trim((string)($s['flightNumber']??''))),
        'slotCode'     => strtolower(trim((string)($s['slotCode']??'slot-'.($i+1)))),
        'departureTime'=> _admin_norm_time((string)($s['departureTime']??'')),
        'active'       => isset($s['active'])?(bool)$s['active']:true,
    ], $scheds, array_keys($scheds));

    if (!$from||!$to||!$hub) throw new RuntimeException('fromAirport, toAirport and hubAirport are required.', 400);
    if (!in_array($status,['active','inactive'],true)) throw new RuntimeException('Route status must be active or inactive.', 400);
    if (!$scheds) throw new RuntimeException('At least one route schedule is required.', 400);
    foreach ($scheds as $i=>$s) {
        if (!$s['flightNumber']) throw new RuntimeException('Schedule '.($i+1).' is missing a flight number.', 400);
    }
    return ['fromAirport'=>$from,'toAirport'=>$to,'hubAirport'=>$hub,'aircraftId'=>$aircraftId,'status'=>$status,'schedules'=>$scheds];
}

function _admin_norm_time(string $t): string {
    $t = trim($t);
    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/',$t)) throw new RuntimeException('Departure time must use HH:MM or HH:MM:SS format.', 400);
    return strlen($t)===5 ? $t.':00' : $t;
}

function _admin_route_metrics(string $from, string $to, ?string $hub, ?int $aircraftId): array {
    $airports = get_airports();
    $orig = $airports[$from]??null; $dest = $airports[$to]??null;
    if (!$orig||!$dest) throw new RuntimeException('One or more airports do not exist.', 400);
    if ($hub&&!isset($airports[$hub])) throw new RuntimeException('The selected hub airport does not exist.', 400);
    if ($from===$to) throw new RuntimeException('Origin and destination must be different airports.', 400);

    $km   = haversine($orig['lat'],$orig['lon'],$dest['lat'],$dest['lon']);
    $dur  = estimate_duration_minutes($km);
    if ($aircraftId) {
        $s = db()->prepare("SELECT cruise_speed_kmh FROM aircraft WHERE id=? LIMIT 1"); $s->execute([$aircraftId]);
        $speed = (int)($s->fetchColumn()?:0);
        if ($speed>0) $dur = (int)round(($km/$speed)*60)+($km<1000?45:30);
    }
    return ['distanceKm'=>$km,'durationMinutes'=>$dur];
}

function _admin_create_route(array $p): array {
    $metrics = _admin_route_metrics($p['fromAirport'],$p['toAirport'],$p['hubAirport']??null,$p['aircraftId']??null);
    $pdo = db(); $pdo->beginTransaction();
    try {
        $s = $pdo->prepare("INSERT INTO routes (from_airport,to_airport,hub_airport,distance_km,duration_minutes,aircraft_id,status) VALUES (?,?,?,?,?,?,?)");
        $s->execute([$p['fromAirport'],$p['toAirport'],$p['hubAirport'],$metrics['distanceKm'],$metrics['durationMinutes'],$p['aircraftId']??null,$p['status']??'active']);
        $id = (int)$pdo->lastInsertId();
        _admin_replace_schedules($pdo,$id,$p['schedules']);
        $pdo->commit();
        return get_route_by_id($id);
    } catch (Throwable $e) { $pdo->rollBack(); _admin_throw_write($e); }
}

function _admin_update_route(int $id, array $p): array {
    $metrics = _admin_route_metrics($p['fromAirport'],$p['toAirport'],$p['hubAirport']??null,$p['aircraftId']??null);
    $pdo = db(); $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE routes SET from_airport=?,to_airport=?,hub_airport=?,distance_km=?,duration_minutes=?,aircraft_id=?,status=? WHERE id=?")
            ->execute([$p['fromAirport'],$p['toAirport'],$p['hubAirport'],$metrics['distanceKm'],$metrics['durationMinutes'],$p['aircraftId']??null,$p['status']??'active',$id]);
        _admin_replace_schedules($pdo,$id,$p['schedules']);
        $pdo->commit();
        return get_route_by_id($id);
    } catch (Throwable $e) { $pdo->rollBack(); _admin_throw_write($e); }
}

function _admin_replace_schedules(PDO $pdo, int $routeId, array $scheds): void {
    $pdo->prepare("DELETE FROM route_schedules WHERE route_id=?")->execute([$routeId]);
    $s = $pdo->prepare("INSERT INTO route_schedules (route_id,flight_number,slot_code,departure_time,active) VALUES (?,?,?,?,?)");
    foreach ($scheds as $sch) { $s->execute([$routeId,$sch['flightNumber'],$sch['slotCode'],$sch['departureTime'],$sch['active']?1:0]); }
}

function _admin_throw_write(Throwable $e): never {
    $msg = $e->getMessage();
    if ($e->getCode()==='23000'||str_contains($msg,'Duplicate')) {
        if (str_contains($msg,'uq_route_pair')) throw new RuntimeException('A route for that airport pair already exists.', 409);
        if (str_contains($msg,'flight_number'))  throw new RuntimeException('That flight number is already assigned to another route.', 409);
    }
    if (str_contains($msg,'foreign key constraint fails')) throw new RuntimeException('The selected aircraft does not exist.', 400);
    throw $e;
}

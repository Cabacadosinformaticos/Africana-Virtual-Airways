<?php
declare(strict_types=1);

// ── Distance ──────────────────────────────────────────────────────────────────

function haversine(float $lat1, float $lon1, float $lat2, float $lon2): int {
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a    = sin($dLat/2)**2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon/2)**2;
    return (int) round(6371 * 2 * atan2(sqrt($a), sqrt(1 - $a)));
}

function estimate_duration_minutes(int $km): int {
    return (int) round(($km / 820) * 60) + ($km < 1000 ? 45 : 30);
}

function format_duration(float $mins): string {
    $safe = max(0, (int) round($mins));
    return intdiv($safe, 60) . 'h ' . str_pad((string)($safe % 60), 2, '0', STR_PAD_LEFT) . 'm';
}

// ── Oil price (cached, refreshed every 24 h) ──────────────────────────────────

function oil_fuel_multiplier(): float {
    static $mult = null;
    if ($mult !== null) return $mult;

    $file = sys_get_temp_dir() . '/afv_oil_cache.json';
    if (file_exists($file)) {
        $d = json_decode((string) file_get_contents($file), true);
        if (is_array($d) && (time() - (int)($d['fetchedAt'] ?? 0)) < 86400) {
            return $mult = (float) ($d['multiplier'] ?? 1.0);
        }
    }

    $apiKey = getenv('ALPHA_VANTAGE_KEY') ?: '';
    if ($apiKey) {
        $url = 'https://www.alphavantage.co/query?function=BRENT&interval=monthly&apikey=' . urlencode($apiKey);
        $ctx = stream_context_create(['http' => ['timeout' => 8, 'user_agent' => 'AfricanaVirtualAirways/1.0']]);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw) {
            $json = json_decode($raw, true);
            $price = (float) ($json['data'][0]['value'] ?? 0);
            if ($price > 0) {
                $m = max(0.70, min(1.50, 0.70 + 0.30 * ($price / 80.0)));
                file_put_contents($file, json_encode(['price' => $price, 'multiplier' => $m, 'fetchedAt' => time(), 'source' => 'live']));
                return $mult = $m;
            }
        }
    }

    return $mult = 1.0;
}

function oil_context(): array {
    $file = sys_get_temp_dir() . '/afv_oil_cache.json';
    $d    = file_exists($file) ? (json_decode((string) file_get_contents($file), true) ?? []) : [];
    return [
        'priceUSD'   => (float) ($d['price']      ?? 80.0),
        'baseline'   => 80.0,
        'multiplier' => (float) ($d['multiplier'] ?? 1.0),
        'source'     => (string)($d['source']     ?? 'fallback'),
        'cachedAt'   => isset($d['fetchedAt']) ? date('c', (int)$d['fetchedAt']) : null,
    ];
}

// ── Pricing ───────────────────────────────────────────────────────────────────

function pricing_region(?string $icao): string {
    if (!$icao) return 'other';
    $p2 = strtoupper(substr($icao, 0, 2));
    $p1 = strtoupper(substr($icao, 0, 1));
    $africa   = ['FA','FB','FC','FD','FE','FG','FH','FI','FJ','FK','FL','FM','FN','FO','FP','FQ','FS','FT','FV','FW','FX','FY','FZ','DA','DB','DC','DD','DF','DG','DI','DN','DR','DT','DX','GM','GQ','GS','GU','GV','HA','HB','HC','HD','HE','HH','HK','HL','HR','HS','HT','HU'];
    $europe   = ['ED','EF','EG','EH','EI','EK','EL','EN','EP','ES','ET','EV','EY','LB','LC','LD','LE','LF','LG','LH','LI','LJ','LK','LL','LM','LN','LO','LP','LQ','LR','LS','LT','LU','LV','LW','LX','LY','LZ','UB','UD','UE','UG','UK','UM','UT','UU','UW'];
    $asiapac  = ['VH','YM','YB','RJ','RK','WS','WI','VT','VD','VL','VN','ZS','ZB','ZG','ZH','ZL','ZP','ZU','ZW','ZY','PH','PK','PL','PM','PP','PT','PW'];
    if (in_array($p2, $africa,  true)) return 'africa';
    if (in_array($p2, $europe,  true)) return 'europe';
    if ($p1 === 'O')                   return 'middle_east';
    if (in_array($p2, $asiapac, true)) return 'asia_pacific';
    if ($p1 === 'K' || $p1 === 'C' || in_array($p2, ['SB','TI','MD'], true)) return 'americas';
    return 'other';
}

function pricing_season_mult(DateTime $date, ?string $destIcao): float {
    $m = (int) $date->format('n');
    switch (pricing_region($destIcao)) {
        case 'africa':
            return in_array($m,[11,12,1,2],true)?1.30:(in_array($m,[6,7,8],true)?1.05:(in_array($m,[9,10],true)?1.00:0.85));
        case 'europe':
            return in_array($m,[6,7,8],true)?1.40:(in_array($m,[12,1],true)?1.20:(in_array($m,[4,5,9,10],true)?1.05:0.85));
        case 'middle_east':
            return in_array($m,[11,12,1,2,3],true)?1.25:(in_array($m,[4,10],true)?1.00:0.78);
        case 'americas':
            return in_array($m,[6,7,8],true)?1.35:(in_array($m,[12,1],true)?1.25:(in_array($m,[4,5,9,10],true)?1.00:0.85));
        case 'asia_pacific':
            return in_array($m,[7,8],true)?1.28:(in_array($m,[12,1],true)?1.22:(in_array($m,[4,5,10,11],true)?1.05:(in_array($m,[2,3,6],true)?0.90:1.00)));
        default:
            return in_array($m,[6,7,8,12],true)?1.25:(in_array($m,[4,5,9,10],true)?1.05:0.88);
    }
}

function calc_price(int $km, string $cabin, DateTime $date, float $load = 0.6, int $pax = 1, ?string $destIcao = null): array {
    static $classMults = ['economy'=>1.0,'business'=>3.2,'first'=>6.5];
    static $demandTiers = [[0.90,1.45],[0.75,1.20],[0.50,1.00],[0.25,0.85],[0.00,0.70]];

    $base      = max(45, (int)round(($km > 5000 ? $km * 0.065 * 0.80 : $km * 0.065)));
    $classMult = $classMults[$cabin] ?? 1.0;
    $seasonMult = pricing_season_mult($date, $destIcao);
    $demandMult = 0.70;
    foreach ($demandTiers as [$t, $m]) { if ($load >= $t) { $demandMult = $m; break; } }
    $fuelMult    = oil_fuel_multiplier();
    $fuelBase    = $base * (0.70 + 0.30 * $fuelMult);
    $perPerson   = (int) round($fuelBase * $classMult * $seasonMult * $demandMult + 45);

    return ['perPerson' => $perPerson, 'total' => $perPerson * $pax];
}

function all_class_prices(int $km, DateTime $date, float $load = 0.6, ?string $destIcao = null): array {
    return [
        'economy'  => calc_price($km, 'economy',  $date, $load, 1, $destIcao),
        'business' => calc_price($km, 'business', $date, $load, 1, $destIcao),
        'first'    => calc_price($km, 'first',    $date, $load, 1, $destIcao),
    ];
}

// ── Airport cache ─────────────────────────────────────────────────────────────

function get_airports(): array {
    static $cache = null;
    if ($cache !== null) return $cache;
    $rows  = db()->query("SELECT * FROM airports ORDER BY icao ASC")->fetchAll();
    $cache = [];
    foreach ($rows as $r) {
        $cache[$r['icao']] = ['icao'=>$r['icao'],'iata'=>$r['iata'],'name'=>$r['name'],'city'=>$r['city'],
            'country'=>$r['country'],'lat'=>(float)$r['lat'],'lon'=>(float)$r['lon'],'hub'=>$r['hub']==1];
    }
    return $cache;
}

// ── Route queries ─────────────────────────────────────────────────────────────

function get_routes_with_schedules(): array {
    $stmt = db()->query(
        "SELECT r.id,r.from_airport,r.to_airport,r.hub_airport,r.distance_km,r.duration_minutes,r.status,
                a.id AS aircraft_id,a.registration,a.type,a.category,a.hub,a.hub_name,
                a.economy_seats,a.business_seats,a.first_seats,
                af.name AS from_airport_name,af.city AS from_city,af.country AS from_country,
                at.name AS to_airport_name,  at.city AS to_city,  at.country AS to_country,
                ah.name AS hub_airport_name, ah.city AS hub_city, ah.country AS hub_country,
                s.id AS schedule_id,s.flight_number,s.slot_code,
                TIME_FORMAT(s.departure_time,'%H:%i:%s') AS departure_time,s.active AS schedule_active
         FROM routes r
         LEFT JOIN aircraft a  ON a.id=r.aircraft_id
         LEFT JOIN airports af ON af.icao=r.from_airport
         LEFT JOIN airports at ON at.icao=r.to_airport
         LEFT JOIN airports ah ON ah.icao=r.hub_airport
         LEFT JOIN route_schedules s ON s.route_id=r.id
         ORDER BY r.id ASC,s.departure_time ASC"
    );
    return _map_route_rows($stmt->fetchAll());
}

function get_route_by_id(int $id): ?array {
    $stmt = db()->prepare(
        "SELECT r.id,r.from_airport,r.to_airport,r.hub_airport,r.distance_km,r.duration_minutes,r.status,
                a.id AS aircraft_id,a.registration,a.type,a.category,a.hub,a.hub_name,
                a.economy_seats,a.business_seats,a.first_seats,
                af.name AS from_airport_name,af.city AS from_city,af.country AS from_country,
                at.name AS to_airport_name,  at.city AS to_city,  at.country AS to_country,
                ah.name AS hub_airport_name, ah.city AS hub_city, ah.country AS hub_country,
                s.id AS schedule_id,s.flight_number,s.slot_code,
                TIME_FORMAT(s.departure_time,'%H:%i:%s') AS departure_time,s.active AS schedule_active
         FROM routes r
         LEFT JOIN aircraft a  ON a.id=r.aircraft_id
         LEFT JOIN airports af ON af.icao=r.from_airport
         LEFT JOIN airports at ON at.icao=r.to_airport
         LEFT JOIN airports ah ON ah.icao=r.hub_airport
         LEFT JOIN route_schedules s ON s.route_id=r.id
         WHERE r.id=? ORDER BY s.departure_time ASC"
    );
    $stmt->execute([$id]);
    $rows = _map_route_rows($stmt->fetchAll());
    return $rows[0] ?? null;
}

function get_schedules_by_flight_numbers(array $fns): array {
    if (!$fns) return [];
    $ph   = implode(',', array_fill(0, count($fns), '?'));
    $stmt = db()->prepare(
        "SELECT r.id,r.from_airport,r.to_airport,r.hub_airport,r.distance_km,r.duration_minutes,
                a.id AS aircraft_id,a.registration,a.type,a.category,a.hub,a.hub_name,
                a.economy_seats,a.business_seats,a.first_seats,
                s.id AS schedule_id,s.flight_number,s.slot_code,
                TIME_FORMAT(s.departure_time,'%H:%i:%s') AS departure_time,s.active AS schedule_active
         FROM route_schedules s
         INNER JOIN routes r ON r.id=s.route_id
         LEFT JOIN aircraft a ON a.id=r.aircraft_id
         WHERE s.flight_number IN ({$ph})"
    );
    $stmt->execute($fns);
    return array_map(fn($row) => [
        'routeId'         => $row['id'],
        'fromAirport'     => $row['from_airport'],
        'toAirport'       => $row['to_airport'],
        'hubAirport'      => $row['hub_airport'],
        'distanceKm'      => (int)$row['distance_km'],
        'durationMinutes' => (int)$row['duration_minutes'],
        'aircraft'        => _map_aircraft_summary($row),
        'schedule'        => ['id'=>$row['schedule_id'],'flightNumber'=>$row['flight_number'],'slotCode'=>$row['slot_code'],'departureTime'=>$row['departure_time'],'active'=>(bool)$row['schedule_active']],
    ], $stmt->fetchAll());
}

function _map_route_rows(array $rows): array {
    $grouped = [];
    foreach ($rows as $row) {
        $id = $row['id'];
        if (!isset($grouped[$id])) {
            $grouped[$id] = [
                'id'=>$row['id'],'fromAirport'=>$row['from_airport'],'toAirport'=>$row['to_airport'],
                'hubAirport'=>$row['hub_airport'],'distanceKm'=>$row['distance_km'],
                'durationMinutes'=>$row['duration_minutes'],'status'=>$row['status'],
                'aircraftId'=>$row['aircraft_id'],'aircraft'=>_map_aircraft_summary($row),
                'fromAirportDetails'=>['icao'=>$row['from_airport'],'name'=>$row['from_airport_name'],'city'=>$row['from_city'],'country'=>$row['from_country']],
                'toAirportDetails'  =>['icao'=>$row['to_airport'],  'name'=>$row['to_airport_name'],  'city'=>$row['to_city'],  'country'=>$row['to_country']],
                'hubAirportDetails' =>['icao'=>$row['hub_airport'],  'name'=>$row['hub_airport_name'], 'city'=>$row['hub_city'], 'country'=>$row['hub_country']],
                'schedules'=>[],
            ];
        }
        if ($row['schedule_id']) {
            $grouped[$id]['schedules'][] = ['id'=>$row['schedule_id'],'flightNumber'=>$row['flight_number'],'slotCode'=>$row['slot_code'],'departureTime'=>$row['departure_time'],'active'=>(bool)$row['schedule_active']];
        }
    }
    return array_values($grouped);
}

function _map_aircraft_summary(array $row): ?array {
    if (empty($row['aircraft_id'])) return null;
    return ['id'=>$row['aircraft_id'],'registration'=>$row['registration'],'type'=>$row['type'],'category'=>$row['category'],
        'hub'=>$row['hub'],'hubName'=>$row['hub_name'],
        'seats'=>['economy'=>$row['economy_seats'],'business'=>$row['business_seats'],'first'=>$row['first_seats']]];
}

// ── Itinerary helpers ─────────────────────────────────────────────────────────

function it_combine(string $date, string $time): DateTime {
    $t = strlen($time) === 5 ? "{$time}:00" : $time;
    $dt = DateTime::createFromFormat('Y-m-d H:i:s', "{$date} {$t}");
    if ($dt === false) throw new RuntimeException("Invalid date/time: {$date} {$t}");
    return $dt;
}

function it_add_minutes(DateTime $dt, int $mins): DateTime {
    $r = clone $dt; $r->modify("{$mins} minutes"); return $r;
}

function it_format_display(DateTime $dt, ?DateTime $ref = null): string {
    $v = $dt->format('H:i');
    if (!$ref) return $v;
    $offset = (int)round((it_sod($dt)->getTimestamp() - it_sod($ref)->getTimestamp()) / 86400);
    return $offset > 0 ? "{$v}+{$offset}" : $v;
}

function it_sod(DateTime $dt): DateTime { $r = clone $dt; $r->setTime(0,0,0,0); return $r; }

function it_time_to_mins(string $t): int {
    $p = explode(':', $t); return (int)($p[0]??0)*60 + (int)($p[1]??0) + intdiv((int)($p[2]??0),60);
}

function parse_json_field(mixed $v, mixed $fallback = null): mixed {
    if ($v === null) return $fallback;
    if (is_string($v)) { $d = json_decode($v, true); return json_last_error()===JSON_ERROR_NONE ? $d : $fallback; }
    return $v;
}

// ── Flight search ─────────────────────────────────────────────────────────────

function search_itineraries(string $from, string $to, ?string $date, int $pax = 1): array {
    $airports = get_airports();
    $origin   = $airports[$from] ?? null;
    $dest     = $airports[$to]   ?? null;
    if (!$origin || !$dest) throw new RuntimeException('Airport not found', 404);

    if (!$date) { $d = new DateTime(); $d->modify('+7 days'); $date = $d->format('Y-m-d'); }

    $routes       = get_routes_with_schedules();
    $activeRoutes = array_filter($routes, fn($r) => $r['status'] === 'active');
    $byOrigin     = [];
    foreach ($activeRoutes as $r) { $byOrigin[$r['fromAirport']][] = $r; }

    $paths = _search_find_paths($from, $to, $byOrigin);
    $itineraries = [];
    foreach ($paths as $path) {
        foreach (_search_build_path($path, $date, $pax) as $it) {
            $itineraries[] = $it;
        }
    }

    usort($itineraries, fn($a,$b) => $a['stopCount']!==$b['stopCount'] ? $a['stopCount']-$b['stopCount'] : $a['pricesPerPerson']['economy']-$b['pricesPerPerson']['economy']);

    return ['origin'=>$origin,'destination'=>$dest,'travelDate'=>$date,
        'itineraries'=>array_slice($itineraries,0,8),
        'searchSummary'=>['stopsOffered'=>!empty(array_filter($itineraries,fn($i)=>$i['stopCount']>0)),'totalResults'=>count($itineraries)]];
}

function validate_and_hydrate(array $raw): array {
    if (empty($raw['segments']) || !is_array($raw['segments'])) throw new RuntimeException('A valid itinerary is required', 400);

    $fns     = array_column($raw['segments'], 'flightNumber');
    $defs    = get_schedules_by_flight_numbers($fns);
    $defMap  = [];
    foreach ($defs as $d) { $defMap[$d['schedule']['flightNumber']] = $d; }
    if (count($defMap) !== count($fns)) throw new RuntimeException('One or more flight segments are no longer available', 409);

    $prevArr = null;
    $segs    = [];
    foreach ($raw['segments'] as $i => $seg) {
        $def = $defMap[$seg['flightNumber']];
        $depDT = $i === 0 ? it_combine($seg['departureDate'], $def['schedule']['departureTime']) : _search_seq_dep($prevArr, $def['schedule']['departureTime']);
        $arrDT = it_add_minutes($depDT, $def['durationMinutes']);
        $prevArr = $arrDT;

        $segs[] = ['routeId'=>$def['routeId'],'flightNumber'=>$def['schedule']['flightNumber'],
            'from'=>$def['fromAirport'],'to'=>$def['toAirport'],
            'departureDate'=>$depDT->format('Y-m-d'),'arrivalDate'=>$arrDT->format('Y-m-d'),
            'departure'=>it_format_display($depDT),'arrival'=>it_format_display($arrDT,$depDT),
            'departureDateTime'=>$depDT->format('c'),'arrivalDateTime'=>$arrDT->format('c'),
            'durationMinutes'=>$def['durationMinutes'],'duration'=>format_duration($def['durationMinutes']),
            'distanceKm'=>$def['distanceKm'],'aircraft'=>$def['aircraft']];
    }

    $first = $segs[0]; $last = end($segs);
    $totalMins = (strtotime($last['arrivalDateTime']) - strtotime($first['departureDateTime'])) / 60;

    return ['itineraryId'=>$raw['itineraryId']??implode('__',array_map(fn($s)=>"{$s['flightNumber']}_{$s['departureDate']}",$segs)),
        'stopCount'=>max(0,count($segs)-1),'summary'=>count($segs)>1?(count($segs)-1).'stop'.(count($segs)>2?'s':'').' ':'Non-stop',
        'durationMinutes'=>(int)round($totalMins),'duration'=>format_duration($totalMins),
        'segments'=>$segs,'from'=>$first['from'],'to'=>$last['to'],'date'=>$first['departureDate']];
}

function _search_find_paths(string $from, string $to, array $byOrigin): array {
    $paths = []; $queue = [[$from, [], [$from => true]]];
    while ($queue && count($paths) < 50) {
        [$cur, $path, $visited] = array_shift($queue);
        foreach ($byOrigin[$cur] ?? [] as $route) {
            $next = $route['toAirport']; $newPath = array_merge($path, [$route]);
            if ($next === $to) { $paths[] = $newPath; }
            elseif (count($newPath) < 3 && !isset($visited[$next])) {
                $nv = $visited; $nv[$next] = true; $queue[] = [$next, $newPath, $nv];
            }
        }
    }
    return $paths;
}

function _search_build_path(array $path, string $date, int $pax): array {
    if (count($path) === 1) {
        $results = [];
        foreach ($path[0]['schedules'] as $sched) {
            if ($sched['active']) $results[] = _search_direct($path[0], $sched, $date, $pax);
        }
        return $results;
    }
    $results = [];
    foreach ($path[0]['schedules'] as $first) {
        if (!$first['active']) continue;
        $it = _search_multi($path, $first, $date, $pax);
        if ($it) $results[] = $it;
    }
    return $results;
}

function _search_direct(array $route, array $sched, string $date, int $pax): array {
    $dep = it_combine($date, $sched['departureTime']);
    $arr = it_add_minutes($dep, (int)$route['durationMinutes']);
    $seg = _search_make_seg($route, $sched['flightNumber'], $dep, $arr);
    $ppp = _search_build_prices([$seg]);
    return ['itineraryId'=>"{$sched['flightNumber']}_{$date}",'stopCount'=>0,'summary'=>'Non-stop',
        'durationMinutes'=>(int)$route['durationMinutes'],'duration'=>format_duration((int)$route['durationMinutes']),'layoverMinutes'=>0,
        'segments'=>[$seg],'pricesPerPerson'=>$ppp,'prices'=>_search_mult_prices($ppp,$pax),
        'from'=>$route['fromAirport'],'to'=>$route['toAirport'],'date'=>$seg['departureDate']];
}

function _search_multi(array $routes, array $firstSched, string $date, int $pax): ?array {
    $airports = get_airports();
    $segs = [];
    $dep0 = it_combine($date, $firstSched['departureTime']);
    $arr0 = it_add_minutes($dep0, (int)$routes[0]['durationMinutes']);
    $segs[] = _search_make_seg($routes[0], $firstSched['flightNumber'], $dep0, $arr0);

    for ($i = 1; $i < count($routes); $i++) {
        $prevArr  = new DateTime($segs[$i-1]['arrivalDateTime']);
        $active   = array_filter($routes[$i]['schedules'], fn($s) => $s['active']);
        $conn     = _search_pick_conn($prevArr, array_values($active));
        if (!$conn) return null;
        $legArr = it_add_minutes($conn['dt'], (int)$routes[$i]['durationMinutes']);
        $segs[] = _search_make_seg($routes[$i], $conn['flightNumber'], $conn['dt'], $legArr);
    }

    $first = $segs[0]; $last = end($segs);
    $totalMins   = (strtotime($last['arrivalDateTime']) - strtotime($first['departureDateTime'])) / 60;
    $layoverMins = 0;
    for ($i = 1; $i < count($segs); $i++) {
        $layoverMins += (strtotime($segs[$i]['departureDateTime']) - strtotime($segs[$i-1]['arrivalDateTime'])) / 60;
    }

    $stops = count($segs) - 1;
    $stopCities = [];
    for ($i = 0; $i < count($segs) - 1; $i++) $stopCities[] = $airports[$segs[$i]['to']]['city'] ?? $segs[$i]['to'];
    $summary = $stops === 1 ? "1 stop in {$stopCities[0]}" : "{$stops} stops via " . implode(', ', $stopCities);
    $ppp = _search_build_prices($segs);

    return ['itineraryId'=>implode('__',array_map(fn($s)=>"{$s['flightNumber']}_{$s['departureDate']}",$segs)),
        'stopCount'=>$stops,'summary'=>$summary,'durationMinutes'=>(int)round($totalMins),'duration'=>format_duration($totalMins),
        'layoverMinutes'=>(int)round($layoverMins),'layover'=>format_duration($layoverMins),
        'segments'=>$segs,'pricesPerPerson'=>$ppp,'prices'=>_search_mult_prices($ppp,$pax),
        'from'=>$first['from'],'to'=>$last['to'],'date'=>$first['departureDate']];
}

function _search_make_seg(array $route, string $fn, DateTime $dep, DateTime $arr): array {
    return ['routeId'=>$route['id'],'flightNumber'=>$fn,'from'=>$route['fromAirport'],'to'=>$route['toAirport'],
        'departureDate'=>$dep->format('Y-m-d'),'arrivalDate'=>$arr->format('Y-m-d'),
        'departure'=>it_format_display($dep),'arrival'=>it_format_display($arr,$dep),
        'departureDateTime'=>$dep->format('c'),'arrivalDateTime'=>$arr->format('c'),
        'durationMinutes'=>(int)$route['durationMinutes'],'duration'=>format_duration((int)$route['durationMinutes']),
        'distanceKm'=>(int)$route['distanceKm'],'aircraft'=>$route['aircraft']];
}

function _search_build_prices(array $segs): array {
    $totals   = [];
    $anyBiz   = false;
    $anyFirst = false;

    foreach ($segs as $seg) {
        $seats    = $seg['aircraft']['seats'] ?? [];
        $hasBiz   = !empty($seats['business']);
        $hasFirst = !empty($seats['first']);
        if ($hasBiz)   $anyBiz   = true;
        if ($hasFirst) $anyFirst = true;

        $date   = DateTime::createFromFormat('Y-m-d H:i:s', $seg['departureDate'] . ' 12:00:00') ?: new DateTime($seg['departureDate']);
        $prices = all_class_prices((int)$seg['distanceKm'], $date);

        $totals['economy']  = ($totals['economy']  ?? 0) + $prices['economy']['perPerson'];
        // Legs without business/first fall back to the next lower cabin price
        $totals['business'] = ($totals['business'] ?? 0) + ($hasBiz   ? $prices['business']['perPerson'] : $prices['economy']['perPerson']);
        $totals['first']    = ($totals['first']    ?? 0) + ($hasFirst  ? $prices['first']['perPerson']   : ($hasBiz ? $prices['business']['perPerson'] : $prices['economy']['perPerson']));
    }

    return [
        'economy'  => $totals['economy']  ?? 0,
        'business' => $anyBiz   ? ($totals['business'] ?? 0) : null,
        'first'    => $anyFirst ? ($totals['first']    ?? 0) : null,
    ];
}

function _search_mult_prices(array $ppp, int $pax): array {
    return ['economy'=>($ppp['economy']??0)*$pax,'business'=>$ppp['business']!==null?$ppp['business']*$pax:null,'first'=>$ppp['first']!==null?$ppp['first']*$pax:null];
}

function _search_seq_dep(DateTime $prevArr, string $depTime): DateTime {
    $earliest = it_add_minutes($prevArr, 90);
    $same     = it_combine($earliest->format('Y-m-d'), $depTime);
    if ($same >= $earliest) return $same;
    $next = clone $earliest; $next->modify('+1 day');
    return it_combine($next->format('Y-m-d'), $depTime);
}

function _search_pick_conn(DateTime $prevArr, array $scheds): ?array {
    $earliest = it_add_minutes($prevArr, 90);
    usort($scheds, fn($a,$b) => it_time_to_mins($a['departureTime']) - it_time_to_mins($b['departureTime']));
    $searchDate = $earliest->format('Y-m-d');
    for ($day = 0; $day < 2; $day++) {
        foreach ($scheds as $s) {
            $dt = it_combine($searchDate, $s['departureTime']);
            if ($dt >= $earliest) return ['flightNumber' => $s['flightNumber'], 'dt' => $dt];
        }
        $next = clone $earliest; $next->modify('+' . ($day+1) . ' day'); $searchDate = $next->format('Y-m-d');
    }
    return null;
}

// ── Booking helpers ───────────────────────────────────────────────────────────

function calc_itinerary_total(array $itinerary, string $cabin, int $pax): float {
    $dest  = $itinerary['to'] ?? null;
    $total = 0.0;
    foreach ($itinerary['segments'] as $seg) {
        $date  = DateTime::createFromFormat('Y-m-d H:i:s', $seg['departureDate'] . ' 12:00:00') ?: new DateTime($seg['departureDate']);
        $p     = all_class_prices((int)$seg['distanceKm'], $date, 0.6, $dest);
        $total += ($p[$cabin]['perPerson'] ?? 0) * $pax;
    }
    return $total;
}

function map_booking(?array $row): ?array {
    if (!$row) return null;
    return ['id'=>$row['id'],'bookingRef'=>$row['booking_ref'],'userId'=>$row['user_id'],
        'userName'=>$row['user_name'],'passengerEmail'=>$row['passenger_email'],
        'flightNumber'=>$row['flight_number'],'from'=>$row['from_airport'],'to'=>$row['to_airport'],
        'date'=>(string)$row['travel_date'],'cabinClass'=>$row['cabin_class'],'passengers'=>$row['passengers'],
        'totalPrice'=>(float)$row['total_price'],'status'=>$row['status'],'seat'=>$row['seat_selection'],
        'passengerDetails'=>parse_json_field($row['passenger_details'],[]),
        'itinerary'=>parse_json_field($row['itinerary'],['segments'=>[]]),
        'createdAt'=>$row['created_at'],'updatedAt'=>$row['updated_at'],'cancelledAt'=>$row['cancelled_at']];
}

function hydrate_bookings(array $bookings): array {
    if (!$bookings) return $bookings;
    $ids = array_filter(array_column($bookings,'id'));
    if (!$ids) return $bookings;
    $ph  = implode(',', array_fill(0, count($ids), '?'));

    $pRows = db()->prepare("SELECT booking_id,passenger_index,first_name,last_name,email,phone,nationality,seat_selection FROM booking_passengers WHERE booking_id IN ({$ph}) ORDER BY booking_id,passenger_index");
    $pRows->execute($ids); $pRows = $pRows->fetchAll();

    $sRows = db()->prepare("SELECT booking_id,segment_index,route_id,flight_number,from_airport,to_airport,departure_date,arrival_date,departure_time,arrival_time,departure_datetime,arrival_datetime,duration_minutes,distance_km,aircraft_id,aircraft_registration,aircraft_type FROM booking_segments WHERE booking_id IN ({$ph}) ORDER BY booking_id,segment_index");
    $sRows->execute($ids); $sRows = $sRows->fetchAll();

    $byP = []; foreach ($pRows as $r) { $byP[$r['booking_id']][] = ['firstName'=>$r['first_name'],'lastName'=>$r['last_name'],'email'=>$r['email'],'phone'=>$r['phone']??'','nationality'=>$r['nationality']??'','seat'=>$r['seat_selection']??null]; }
    $byS = []; foreach ($sRows as $r) {
        $byS[$r['booking_id']][] = ['routeId'=>$r['route_id'],'flightNumber'=>$r['flight_number'],'from'=>$r['from_airport'],'to'=>$r['to_airport'],
            'departureDate'=>(string)$r['departure_date'],'arrivalDate'=>(string)$r['arrival_date'],
            'departure'=>$r['departure_time'],'arrival'=>$r['arrival_time'],
            'departureDateTime'=>(string)$r['departure_datetime'],'arrivalDateTime'=>(string)$r['arrival_datetime'],
            'durationMinutes'=>(int)$r['duration_minutes'],'distanceKm'=>(int)$r['distance_km'],
            'aircraft'=>($r['aircraft_id']||$r['aircraft_registration']||$r['aircraft_type'])?['id'=>$r['aircraft_id'],'registration'=>$r['aircraft_registration'],'type'=>$r['aircraft_type']]:null];
    }

    foreach ($bookings as &$b) {
        if (!empty($byP[$b['id']])) $b['passengerDetails'] = $byP[$b['id']];
        if (!empty($byS[$b['id']])) $b['itinerary'] = array_merge($b['itinerary']??[],['segments'=>$byS[$b['id']]]);
    }
    return $bookings;
}

function generate_booking_ref(): string {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    while (true) {
        $ref = 'AFV';
        for ($i = 0; $i < 6; $i++) $ref .= $chars[random_int(0, strlen($chars)-1)];
        $s = db()->prepare("SELECT id FROM bookings WHERE booking_ref=? LIMIT 1"); $s->execute([$ref]);
        if (!$s->fetch()) return $ref;
    }
}

function norm_dt(?string $v, string $fallback): string {
    if ($v) return str_replace(['T','Z'],[' ',''],$v);
    return "{$fallback} 00:00:00";
}

// ── User helpers ──────────────────────────────────────────────────────────────

function map_user(?array $row): ?array {
    if (!$row) return null;
    return ['id'=>$row['id'],'name'=>$row['name'],'email'=>$row['email'],'password'=>$row['password'],
        'vatsimCid'=>$row['vatsim_cid'],'role'=>$row['role'],'isPrimaryAdmin'=>(bool)$row['is_primary_admin'],
        'createdByUserId'=>$row['created_by_user_id'],'createdByName'=>$row['created_by_name']??null,
        'joinedAt'=>$row['joined_at'],'flightHours'=>$row['flight_hours'],'points'=>$row['points']];
}

function safe_user(?array $user): ?array {
    if (!$user) return null; $s = $user; unset($s['password']); return $s;
}

function find_user_by_email(string $email): ?array {
    $s = db()->prepare("SELECT * FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1");
    $s->execute([$email]); return map_user($s->fetch()?:null);
}

function find_user_by_id(int $id): ?array {
    $s = db()->prepare("SELECT * FROM users WHERE id=? LIMIT 1");
    $s->execute([$id]); return map_user($s->fetch()?:null);
}

// ── Aircraft helpers ──────────────────────────────────────────────────────────

function map_aircraft(?array $row): ?array {
    if (!$row) return null;
    return ['id'=>$row['id'],'registration'=>$row['registration'],'type'=>$row['type'],'category'=>$row['category'],
        'hub'=>$row['hub'],'hub_name'=>$row['hub_name'],
        'seats'=>['economy'=>$row['economy_seats'],'business'=>$row['business_seats'],'first'=>$row['first_seats']],
        'range_km'=>$row['range_km'],'cruise_speed_kmh'=>$row['cruise_speed_kmh'],
        'status'=>$row['status'],'image'=>$row['image'],'description'=>$row['description']];
}

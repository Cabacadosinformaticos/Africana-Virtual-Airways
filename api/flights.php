<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

cors_headers();
$method = $_SERVER['REQUEST_METHOD'];
$path   = api_path('/api/flights');

// GET /api/flights/airports
if ($method === 'GET' && $path === 'airports') {
    json_ok(get_airports());
}

// GET /api/flights/routes
if ($method === 'GET' && $path === 'routes') {
    $airports = get_airports();
    $routes   = get_routes_with_schedules();
    $result   = [];
    foreach ($routes as $r) {
        if ($r['status'] !== 'active') continue;
        $from = $airports[$r['fromAirport']] ?? null;
        $to   = $airports[$r['toAirport']]   ?? null;
        $hub  = $airports[$r['hubAirport']]  ?? null;
        $result[] = [
            'from'=>$r['fromAirport'],'to'=>$r['toAirport'],
            'fromIata'=>$from['iata']??$r['fromAirport'],'toIata'=>$to['iata']??$r['toAirport'],
            'fromCity'=>$from['city']??$r['fromAirport'],'toCity'=>$to['city']??$r['toAirport'],
            'fromCoords'=>$from?[$from['lat'],$from['lon']]:null,
            'toCoords'  =>$to  ?[$to['lat'],  $to['lon']]:null,
            'distanceKm'=>$r['distanceKm'],'hub'=>$r['hubAirport'],
            'hubIata'=>$hub['iata']??$r['hubAirport'],
        ];
    }
    json_ok($result);
}

// GET /api/flights/search
if ($method === 'GET' && $path === 'search') {
    $from = strtoupper(trim((string)($_GET['from'] ?? '')));
    $to   = strtoupper(trim((string)($_GET['to']   ?? '')));
    $date = $_GET['date'] ?? null;
    $pax  = max(1, (int)($_GET['passengers'] ?? 1));
    if (!$from || !$to) json_err('from and to are required');
    try { json_ok(search_itineraries($from, $to, $date ?: null, $pax)); }
    catch (RuntimeException $e) { json_err($e->getMessage(), $e->getCode() ?: 400); }
}

// POST /api/flights/itinerary
if ($method === 'POST' && $path === 'itinerary') {
    $body       = req_body();
    $pax        = max(1, (int)($body['passengers'] ?? 1));
    try {
        $hydrated = validate_and_hydrate((array)($body['itinerary'] ?? []));
    } catch (RuntimeException $e) { json_err($e->getMessage(), $e->getCode() ?: 400); }

    $dest = $hydrated['to'] ?? null;
    $ppp  = ['economy'=>0,'business'=>0,'first'=>0];
    foreach ($hydrated['segments'] as $seg) {
        $date   = DateTime::createFromFormat('Y-m-d H:i:s', $seg['departureDate'] . ' 12:00:00') ?: new DateTime($seg['departureDate']);
        $prices = all_class_prices((int)$seg['distanceKm'], $date, 0.6, $dest);
        $ppp['economy']  += $prices['economy']['perPerson'];
        $ppp['business'] += $prices['business']['perPerson'];
        $ppp['first']    += $prices['first']['perPerson'];
    }
    json_ok(array_merge($hydrated, [
        'pricesPerPerson' => $ppp,
        'prices' => ['economy'=>$ppp['economy']*$pax,'business'=>$ppp['business']*$pax,'first'=>$ppp['first']*$pax],
    ]));
}

// GET /api/flights/pricing-factors
if ($method === 'GET' && $path === 'pricing-factors') {
    $dateStr = $_GET['date'] ?? null;
    $date    = $dateStr ? new DateTime($dateStr) : new DateTime();
    $probes  = ['africa'=>'FQMA','europe'=>'LFPG','middle_east'=>'OMDB','americas'=>'KORD','asia_pacific'=>'WSSS'];
    $seasonal = [];
    foreach ($probes as $region => $probe) {
        $mult = pricing_season_mult($date, $probe);
        $seasonal[$region] = ['multiplier'=>$mult,'label'=>($mult>=1.30?'peak':($mult>=1.10?'high':($mult>=0.95?'shoulder':'low')))];
    }
    json_ok(['oil'=>oil_context(),'seasonal'=>$seasonal,'updatedAt'=>(new DateTime())->format('c')]);
}

// POST /api/flights/seat-map
if ($method === 'POST' && $path === 'seat-map') {
    $body  = req_body();
    $it    = $body['itinerary']  ?? null;
    $cabin = $body['cabinClass'] ?? '';
    if (!$it || empty($it['segments'])) json_err('A valid itinerary is required');
    if (!in_array($cabin, ['economy','business','first'], true)) json_err('A valid cabin class is required');

    $segs = $it['segments'];
    if (!$segs) { json_ok(['occupiedSeats' => [], 'layout' => null]); }

    // Occupied seats
    $conds = implode(' OR ', array_fill(0, count($segs), '(flight_number=? AND departure_date=?)'));
    $vals  = [$cabin];
    foreach ($segs as $seg) { $vals[] = $seg['flightNumber']; $vals[] = $seg['departureDate']; }
    $stmt  = db()->prepare("SELECT DISTINCT seat_id FROM booked_seats WHERE cabin_class=? AND ({$conds})");
    $stmt->execute($vals);
    $occupiedSeats = array_column($stmt->fetchAll(), 'seat_id');

    // Aircraft layout from aircraft.json via route_schedules → routes → aircraft
    $layout = null;
    $flightNum = $segs[0]['flightNumber'] ?? null;
    if ($flightNum) {
        $q = db()->prepare("
            SELECT a.registration
            FROM route_schedules rs
            JOIN routes r  ON r.id  = rs.route_id
            JOIN aircraft a ON a.id = r.aircraft_id
            WHERE rs.flight_number = ?
            LIMIT 1
        ");
        $q->execute([$flightNum]);
        $row = $q->fetch();
        if ($row) {
            $file = PROJECT_ROOT . '/data/aircraft.json';
            if (file_exists($file)) {
                foreach ((json_decode((string)file_get_contents($file), true) ?: []) as $ac) {
                    if ($ac['registration'] !== $row['registration']) continue;
                    $sm    = $ac['seatMap'] ?? [];
                    $cabin_data = $sm[$cabin] ?? null;
                    $offset = 0;
                    foreach (['first','business','economy'] as $c) {
                        if ($c === $cabin) break;
                        $offset += (int)(($sm[$c]['rows'] ?? 0));
                    }
                    if ($cabin_data) {
                        $layout = [
                            'rows'      => (int)($cabin_data['rows']   ?? 20),
                            'config'    => (string)($cabin_data['config'] ?? '3-3-3'),
                            'rowOffset' => $offset,
                            'deck'      => $cabin_data['deck'] ?? null,
                        ];
                    }
                    break;
                }
            }
        }
    }

    // Fallback when aircraft or cabin not found in JSON
    if (!$layout) {
        $layout = [
            'rows'      => ($cabin === 'economy' ? 20 : ($cabin === 'business' ? 8 : 4)),
            'config'    => ($cabin === 'economy' ? '3-3-3' : ($cabin === 'business' ? '2-2-2' : '1-2-1')),
            'rowOffset' => 0,
        ];
    }

    json_ok(['occupiedSeats' => $occupiedSeats, 'layout' => $layout]);
}

json_err('Not found', 404);

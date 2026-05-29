<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

cors_headers();
$method   = $_SERVER['REQUEST_METHOD'];
$path     = api_path('/api/bookings');
$segments = $path ? explode('/', $path) : [];

// GET /api/bookings/my
if ($method === 'GET' && $path === 'my') {
    $jwt  = require_auth();
    $user = find_user_by_id((int)$jwt['id']);
    $email = $user['email'] ?? $jwt['email'] ?? null;

    if ($email) {
        $s = db()->prepare("SELECT * FROM bookings WHERE user_id=? OR LOWER(passenger_email)=LOWER(?) ORDER BY created_at DESC");
        $s->execute([(int)$jwt['id'], $email]);
    } else {
        $s = db()->prepare("SELECT * FROM bookings WHERE user_id=? ORDER BY created_at DESC");
        $s->execute([(int)$jwt['id']]);
    }
    json_ok(hydrate_bookings(array_map('map_booking', $s->fetchAll())));
}

// GET /api/bookings/lookup
if ($method === 'GET' && $path === 'lookup') {
    $ref   = trim((string)($_GET['ref']   ?? ''));
    $email = trim((string)($_GET['email'] ?? ''));
    if (!$ref || !$email) json_err('booking ref and email are required');
    $s = db()->prepare("SELECT * FROM bookings WHERE booking_ref=? AND LOWER(passenger_email)=LOWER(?) LIMIT 1");
    $s->execute([$ref, $email]);
    $row = $s->fetch();
    if (!$row) json_err('Booking not found', 404);
    $list = hydrate_bookings([map_booking($row)]);
    json_ok($list[0]);
}

// GET /api/bookings/{ref}
if ($method === 'GET' && count($segments) === 1 && $segments[0]) {
    $jwt = require_auth();
    $s   = db()->prepare("SELECT * FROM bookings WHERE booking_ref=? LIMIT 1");
    $s->execute([$segments[0]]);
    $row = $s->fetch();
    if (!$row) json_err('Booking not found', 404);
    $booking = hydrate_bookings([map_booking($row)])[0];
    $role    = $jwt['role'] ?? '';
    if ($role !== 'admin' && $booking['userId'] != $jwt['id'] && strtolower((string)$booking['passengerEmail']) !== strtolower((string)($jwt['email'] ?? ''))) json_err('Access denied', 403);
    json_ok($booking);
}

// PUT /api/bookings/{ref}/cancel
if ($method === 'PUT' && count($segments) === 2 && $segments[1] === 'cancel') {
    $jwt = require_auth();
    $s   = db()->prepare("SELECT * FROM bookings WHERE booking_ref=? LIMIT 1");
    $s->execute([$segments[0]]);
    $row = $s->fetch();
    if (!$row) json_err('Booking not found', 404);
    $booking = hydrate_bookings([map_booking($row)])[0];
    $role    = $jwt['role'] ?? '';
    if ($role !== 'admin' && $booking['userId'] != $jwt['id'] && strtolower((string)$booking['passengerEmail']) !== strtolower((string)($jwt['email'] ?? ''))) json_err('Access denied', 403);
    if ($booking['status'] === 'cancelled') json_err('Booking already cancelled');

    $pdo = db(); $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE bookings SET status='cancelled',cancelled_at=NOW() WHERE booking_ref=?")->execute([$segments[0]]);
        $pdo->prepare("DELETE FROM booked_seats WHERE booking_ref=?")->execute([$segments[0]]);
        $pdo->commit();
    } catch (Throwable $e) { $pdo->rollBack(); throw $e; }

    $s->execute([$segments[0]]);
    $row = db()->prepare("SELECT * FROM bookings WHERE booking_ref=? LIMIT 1");
    $row->execute([$segments[0]]);
    json_ok(hydrate_bookings([map_booking($row->fetch())])[0]);
}

// POST /api/bookings
if ($method === 'POST' && !$path) {
    $body             = req_body();
    $itinerary        = $body['itinerary']        ?? null;
    $cabin            = $body['cabinClass']        ?? '';
    $pax              = max(1, (int)($body['passengers'] ?? 1));
    $passengerDetails = (array)($body['passengerDetails'] ?? []);
    $seat             = $body['seat'] ?? null;

    if (!$itinerary) json_err('itinerary is required');
    if (!in_array($cabin, ['economy','business','first'], true)) json_err('A valid cabin class is required');
    if (!$passengerDetails) json_err('At least one passenger is required');

    $primary = $passengerDetails[0];
    if (empty($primary['firstName']) || empty($primary['lastName']) || empty($primary['email'])) json_err('Primary passenger name and email are required');

    $passengerEmail = strtolower(trim((string)$primary['email']));
    $jwtUser        = auth_user();
    $authUser       = $jwtUser ? find_user_by_id((int)$jwtUser['id']) : null;
    $matchedUser    = !$authUser ? find_user_by_email($passengerEmail) : null;
    $owner          = $authUser ?? $matchedUser;

    try { $hydrated = validate_and_hydrate((array)$itinerary); }
    catch (RuntimeException $e) { json_err($e->getMessage(), $e->getCode() ?: 400); }

    if ($seat) {
        $segs  = $hydrated['segments'];
        $conds = implode(' OR ', array_fill(0, count($segs), '(flight_number=? AND departure_date=?)'));
        $vals  = [$cabin];
        foreach ($segs as $seg) { $vals[] = $seg['flightNumber']; $vals[] = $seg['departureDate']; }
        $stmt  = db()->prepare("SELECT DISTINCT seat_id FROM booked_seats WHERE cabin_class=? AND ({$conds})");
        $stmt->execute($vals);
        $occupied = array_column($stmt->fetchAll(), 'seat_id');
        if (in_array($seat, $occupied, true)) json_err('That seat has just been taken. Please choose another one.', 409);
    }

    $passengerCount = max($pax, count($passengerDetails));
    $totalPrice     = calc_itinerary_total($hydrated, $cabin, $passengerCount);
    $ref            = generate_booking_ref();
    $flightNumber   = implode(' / ', array_column($hydrated['segments'], 'flightNumber'));

    $pdo = db(); $pdo->beginTransaction();
    try {
        $s = $pdo->prepare("INSERT INTO bookings (booking_ref,user_id,user_name,passenger_email,flight_number,from_airport,to_airport,travel_date,cabin_class,passengers,total_price,status,seat_selection,passenger_details,itinerary,cancelled_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $s->execute([$ref,$owner['id']??null,$owner['name']??trim(($primary['firstName']??'').' '.($primary['lastName']??'')),
            $passengerEmail,$flightNumber,$hydrated['from'],$hydrated['to'],$hydrated['date'],$cabin,
            $passengerCount,$totalPrice,'confirmed',$seat,
            json_encode(array_map(fn($p)=>array_merge($p,['email'=>!empty($p['email'])?strtolower(trim((string)$p['email'])):'','seat'=>$p['seat']??$seat??null]),$passengerDetails)),
            json_encode($hydrated),null]);
        $bookingId = (int)$pdo->lastInsertId();

        $ps = $pdo->prepare("INSERT INTO booking_passengers (booking_id,passenger_index,first_name,last_name,email,phone,nationality,seat_selection) VALUES (?,?,?,?,?,?,?,?)");
        foreach ($passengerDetails as $i => $p) {
            $ps->execute([$bookingId,$i,trim((string)($p['firstName']??'')),trim((string)($p['lastName']??'')),
                strtolower(trim((string)($p['email']??''))),!empty($p['phone'])?trim((string)$p['phone']):null,
                !empty($p['nationality'])?trim((string)$p['nationality']):null,$p['seat']??($i===0?$seat:null)]);
        }

        $ss = $pdo->prepare("INSERT INTO booking_segments (booking_id,segment_index,route_id,flight_number,from_airport,to_airport,departure_date,arrival_date,departure_time,arrival_time,departure_datetime,arrival_datetime,duration_minutes,distance_km,aircraft_id,aircraft_registration,aircraft_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $bs = $seat ? $pdo->prepare("INSERT INTO booked_seats (flight_number,departure_date,seat_id,cabin_class,booking_ref) VALUES (?,?,?,?,?)") : null;
        foreach ($hydrated['segments'] as $i => $seg) {
            $ss->execute([$bookingId,$i,$seg['routeId']??null,$seg['flightNumber'],$seg['from'],$seg['to'],
                $seg['departureDate'],$seg['arrivalDate']??$seg['departureDate'],$seg['departure']??'',$seg['arrival']??'',
                norm_dt($seg['departureDateTime']??null,$seg['departureDate']),
                norm_dt($seg['arrivalDateTime']??null,$seg['arrivalDate']??$seg['departureDate']),
                $seg['durationMinutes']??0,$seg['distanceKm']??0,
                $seg['aircraft']['id']??null,$seg['aircraft']['registration']??null,$seg['aircraft']['type']??null]);
            if ($bs) $bs->execute([$seg['flightNumber'],$seg['departureDate'],$seat,$cabin,$ref]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        if (str_contains($e->getMessage(),'Duplicate')) json_err('That seat has just been taken. Please choose another seat.', 409);
        throw $e;
    }

    $row = db()->prepare("SELECT * FROM bookings WHERE booking_ref=? LIMIT 1");
    $row->execute([$ref]);
    json_ok(hydrate_bookings([map_booking($row->fetch())])[0], 201);
}

json_err('Not found', 404);

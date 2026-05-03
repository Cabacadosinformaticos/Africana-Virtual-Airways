<?php

declare(strict_types=1);

use AFV\Helpers\PricingHelper;
use AFV\Middleware\Middleware\AttachUserMiddleware;
use AFV\Middleware\Middleware\AuthMiddleware;
use AFV\Repositories\BookingRepository;
use AFV\Repositories\UserRepository;
use AFV\Services\FlightSearchService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;

return function (App $app): void {

    $app->post('/api/bookings', function (Request $request, Response $response): Response {
        $body            = (array) $request->getParsedBody();
        $itinerary       = $body['itinerary']       ?? null;
        $cabinClass      = $body['cabinClass']       ?? '';
        $passengers      = max(1, (int) ($body['passengers'] ?? 1));
        $passengerDetails = (array) ($body['passengerDetails'] ?? []);
        $seat            = $body['seat'] ?? null;

        if (!$itinerary) return json_error($response, 'itinerary is required', 400);
        if (!in_array($cabinClass, ['economy', 'business', 'first'], true)) {
            return json_error($response, 'A valid cabin class is required', 400);
        }
        if (!$passengerDetails) return json_error($response, 'At least one passenger is required', 400);

        $primary = $passengerDetails[0];
        if (empty($primary['firstName']) || empty($primary['lastName']) || empty($primary['email'])) {
            return json_error($response, 'Primary passenger name and email are required', 400);
        }

        $passengerEmail   = strtolower(trim((string) $primary['email']));
        $jwtUser          = $request->getAttribute('user');
        $authenticatedUser = $jwtUser ? UserRepository::findById((int) $jwtUser['id']) : null;
        $matchedUser       = !$authenticatedUser ? UserRepository::findByEmail($passengerEmail) : null;
        $bookingOwner      = $authenticatedUser ?? $matchedUser;

        $hydrated = FlightSearchService::validateAndHydrateItinerary((array) $itinerary);

        if ($seat) {
            $occupied = BookingRepository::getOccupiedSeats($hydrated['segments'], $cabinClass);
            if (in_array($seat, $occupied, true)) {
                return json_error($response, 'That seat has just been taken. Please choose another one.', 409);
            }
        }

        $passengerCount = max($passengers, count($passengerDetails));
        $totalPrice     = calculateItineraryTotal($hydrated, $cabinClass, $passengerCount);
        $bookingRef     = generateUniqueRef();

        $booking = BookingRepository::create([
            'bookingRef'       => $bookingRef,
            'userId'           => $bookingOwner['id'] ?? null,
            'userName'         => $bookingOwner['name'] ?? trim(($primary['firstName'] ?? '') . ' ' . ($primary['lastName'] ?? '')),
            'passengerEmail'   => $passengerEmail,
            'flightNumber'     => implode(' / ', array_column($hydrated['segments'], 'flightNumber')),
            'from'             => $hydrated['from'],
            'to'               => $hydrated['to'],
            'date'             => $hydrated['date'],
            'cabinClass'       => $cabinClass,
            'passengers'       => $passengerCount,
            'totalPrice'       => $totalPrice,
            'status'           => 'confirmed',
            'seat'             => $seat,
            'passengerDetails' => array_map(fn($p) => array_merge($p, [
                'email' => !empty($p['email']) ? strtolower(trim((string) $p['email'])) : '',
                'seat'  => $p['seat'] ?? $seat ?? null,
            ]), $passengerDetails),
            'itinerary'        => $hydrated,
        ]);

        return json_ok($response, $booking, 201);
    })->add(new AttachUserMiddleware());

    $app->get('/api/bookings/my', function (Request $request, Response $response): Response {
        $jwtUser = $request->getAttribute('user');
        $user    = UserRepository::findById((int) $jwtUser['id']);
        $bookings = BookingRepository::listByUserId((int) $jwtUser['id'], $user['email'] ?? $jwtUser['email'] ?? null);
        return json_ok($response, $bookings);
    })->add(new AuthMiddleware());

    $app->get('/api/bookings/lookup', function (Request $request, Response $response): Response {
        $params = $request->getQueryParams();
        $ref    = trim((string) ($params['ref']   ?? ''));
        $email  = trim((string) ($params['email'] ?? ''));

        if (!$ref || !$email) return json_error($response, 'booking ref and email are required', 400);

        $booking = BookingRepository::findByRefAndEmail($ref, $email);
        if (!$booking) return json_error($response, 'Booking not found', 404);
        return json_ok($response, $booking);
    });

    $app->get('/api/bookings/{ref}', function (Request $request, Response $response, array $args): Response {
        $booking = BookingRepository::findByRef($args['ref']);
        if (!$booking) return json_error($response, 'Booking not found', 404);

        $jwtUser = $request->getAttribute('user');
        if (!canAccessBooking($booking, $jwtUser)) return json_error($response, 'Access denied', 403);

        return json_ok($response, $booking);
    })->add(new AuthMiddleware());

    $app->put('/api/bookings/{ref}/cancel', function (Request $request, Response $response, array $args): Response {
        $booking = BookingRepository::findByRef($args['ref']);
        if (!$booking) return json_error($response, 'Booking not found', 404);

        $jwtUser = $request->getAttribute('user');
        if (!canAccessBooking($booking, $jwtUser)) return json_error($response, 'Access denied', 403);

        if ($booking['status'] === 'cancelled') return json_error($response, 'Booking already cancelled', 400);

        $updated = BookingRepository::updateStatus($args['ref'], 'cancelled');
        return json_ok($response, $updated);
    })->add(new AuthMiddleware());

};

function calculateItineraryTotal(array $itinerary, string $cabinClass, int $passengers): float
{
    $destination = $itinerary['to'] ?? null;
    $total = 0.0;
    foreach ($itinerary['segments'] as $seg) {
        $segDate = \DateTime::createFromFormat('Y-m-d H:i:s', $seg['departureDate'] . ' 12:00:00');
        $prices  = PricingHelper::allClassPrices((int) $seg['distanceKm'], $segDate, 0.6, $destination);
        $total  += ($prices[$cabinClass]['perPerson'] ?? 0) * $passengers;
    }
    return $total;
}

function canAccessBooking(array $booking, ?array $user): bool
{
    if (!$user) return false;
    return ($user['role'] ?? '') === 'admin'
        || $booking['userId'] == $user['id']
        || strtolower((string) $booking['passengerEmail']) === strtolower((string) ($user['email'] ?? ''));
}

function generateUniqueRef(): string
{
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    while (true) {
        $candidate = 'AFV';
        for ($i = 0; $i < 6; $i++) {
            $candidate .= $chars[random_int(0, strlen($chars) - 1)];
        }
        if (!BookingRepository::findByRef($candidate)) return $candidate;
    }
}

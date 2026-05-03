<?php

declare(strict_types=1);

use AFV\Middleware\Middleware\AdminMiddleware;
use AFV\Repositories\AircraftRepository;
use AFV\Repositories\AirlineStatsRepository;
use AFV\Repositories\AirportRepository;
use AFV\Repositories\BookingRepository;
use AFV\Repositories\RouteRepository;
use AFV\Repositories\UserRepository;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

return function (App $app): void {

    $app->group('/api/admin', function (RouteCollectorProxy $group): void {

        $group->get('/stats', function (Request $request, Response $response): Response {
            $today    = date('Y-m-d');
            $bookings = BookingRepository::listAll();
            $active   = array_filter($bookings, fn($b) => $b['status'] !== 'cancelled');

            $revenueByClass = ['economy' => 0.0, 'business' => 0.0, 'first' => 0.0];
            foreach ($active as $b) {
                $revenueByClass[$b['cabinClass']] = ($revenueByClass[$b['cabinClass']] ?? 0.0) + $b['totalPrice'];
            }

            $routeCounts = [];
            foreach ($bookings as $b) {
                $key = "{$b['from']}-{$b['to']}";
                $routeCounts[$key] = ($routeCounts[$key] ?? 0) + 1;
            }
            arsort($routeCounts);
            $topRoutes = array_map(fn($r, $c) => ['route' => $r, 'count' => $c],
                array_keys(array_slice($routeCounts, 0, 5, true)),
                array_slice($routeCounts, 0, 5, true)
            );

            return json_ok($response, [
                'totalBookings'     => count($bookings),
                'confirmedBookings' => count($active),
                'cancelledBookings' => count(array_filter($bookings, fn($b) => $b['status'] === 'cancelled')),
                'delayedBookings'   => count(array_filter($bookings, fn($b) => $b['status'] === 'delayed')),
                'todayBookings'     => count(array_filter($bookings, fn($b) => str_starts_with((string)($b['createdAt'] ?? ''), $today))),
                'totalRevenue'      => array_sum(array_column(array_values($active), 'totalPrice')),
                'totalUsers'        => UserRepository::count(),
                'activeFleet'       => AircraftRepository::countActive(),
                'revenueByClass'    => $revenueByClass,
                'topRoutes'         => array_values($topRoutes),
            ]);
        });

        $group->get('/users', function (Request $request, Response $response): Response {
            $users = array_map(fn($u) => UserRepository::toSafeUser($u), UserRepository::listAll());
            return json_ok($response, $users);
        });

        $group->post('/users', function (Request $request, Response $response): Response {
            $jwtUser = $request->getAttribute('user');
            $actor   = UserRepository::findById((int) $jwtUser['id']);
            if (!$actor || !($actor['isPrimaryAdmin'] ?? false)) {
                return json_error($response, 'Only the main admin can manage user logins.', 403);
            }

            $body     = (array) $request->getParsedBody();
            $name     = trim((string) ($body['name']     ?? ''));
            $email    = trim((string) ($body['email']    ?? ''));
            $password = (string) ($body['password'] ?? '');
            $role     = strtolower(trim((string) ($body['role'] ?? 'user')));
            $vatsimCid = trim((string) ($body['vatsimCid'] ?? '')) ?: null;

            if (!$name || !$email || !$password) return json_error($response, 'name, email and password are required', 400);
            if (!in_array($role, ['admin', 'user'], true)) return json_error($response, 'role must be admin or user', 400);
            if (UserRepository::findByEmail($email)) return json_error($response, 'Email already registered', 409);

            $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
            $user = UserRepository::create([
                'name'            => $name,
                'email'           => strtolower($email),
                'password'        => $hash,
                'vatsimCid'       => $vatsimCid,
                'role'            => $role,
                'createdByUserId' => $actor['id'],
            ]);
            return json_ok($response, UserRepository::toSafeUser($user), 201);
        });

        $group->put('/users/{id}/role', function (Request $request, Response $response, array $args): Response {
            $jwtUser = $request->getAttribute('user');
            $actor   = UserRepository::findById((int) $jwtUser['id']);
            if (!$actor || !($actor['isPrimaryAdmin'] ?? false)) {
                return json_error($response, 'Only the main admin can manage user logins.', 403);
            }

            $targetId = (int) $args['id'];
            $target   = UserRepository::findById($targetId);
            if (!$target) return json_error($response, 'User not found', 404);
            if ($target['isPrimaryAdmin']) return json_error($response, 'The main admin role cannot be changed.', 400);

            $role = strtolower(trim((string) (((array) $request->getParsedBody())['role'] ?? 'user')));
            if (!in_array($role, ['admin', 'user'], true)) return json_error($response, 'role must be admin or user', 400);

            $updated = UserRepository::updateRole($targetId, $role);
            return json_ok($response, UserRepository::toSafeUser($updated));
        });

        $group->get('/bookings', function (Request $request, Response $response): Response {
            return json_ok($response, BookingRepository::listAll());
        });

        $group->put('/bookings/{ref}/status', function (Request $request, Response $response, array $args): Response {
            $status = (string) (((array) $request->getParsedBody())['status'] ?? '');
            if (!in_array($status, ['confirmed', 'on_time', 'delayed', 'cancelled'], true)) {
                return json_error($response, 'Invalid status', 400);
            }
            $booking = BookingRepository::updateStatus($args['ref'], $status);
            if (!$booking) return json_error($response, 'Booking not found', 404);
            return json_ok($response, $booking);
        });

        $group->get('/fleet', function (Request $request, Response $response): Response {
            return json_ok($response, AircraftRepository::listAll());
        });

        $group->get('/lookups', function (Request $request, Response $response): Response {
            $airportsMap = AirportRepository::getAll();
            $fleet       = AircraftRepository::listAll();

            $airports = array_values($airportsMap);
            usort($airports, function ($a, $b) {
                if ($a['hub'] !== $b['hub']) return $b['hub'] <=> $a['hub'];
                $c = strcmp($a['city'], $b['city']);
                return $c !== 0 ? $c : strcmp($a['icao'], $b['icao']);
            });

            usort($fleet, function ($a, $b) {
                if ($a['status'] !== $b['status']) return $a['status'] === 'active' ? -1 : 1;
                return strcmp($a['registration'], $b['registration']);
            });

            return json_ok($response, [
                'airports'      => $airports,
                'aircraft'      => $fleet,
                'routeStatuses' => ['active', 'inactive'],
            ]);
        });

        $group->get('/routes', function (Request $request, Response $response): Response {
            $routes = RouteRepository::getRoutesWithSchedules();
            return json_ok($response, [
                'summary' => [
                    'totalRoutes'       => count($routes),
                    'activeRoutes'      => count(array_filter($routes, fn($r) => $r['status'] === 'active')),
                    'inactiveRoutes'    => count(array_filter($routes, fn($r) => $r['status'] !== 'active')),
                    'routesWithAircraft'=> count(array_filter($routes, fn($r) => $r['aircraft'] !== null)),
                    'hubs'              => count(array_unique(array_column($routes, 'hubAirport'))),
                ],
                'routes'  => $routes,
            ]);
        });

        $group->post('/routes', function (Request $request, Response $response): Response {
            $payload = normalizeRoutePayload((array) $request->getParsedBody());
            $route   = RouteRepository::createRoute($payload);
            return json_ok($response, $route, 201);
        });

        $group->put('/routes/{id}', function (Request $request, Response $response, array $args): Response {
            $routeId = (int) $args['id'];
            if (!$routeId) return json_error($response, 'A valid route id is required.', 400);

            $existing = RouteRepository::getRouteById($routeId);
            if (!$existing) return json_error($response, 'Route not found', 404);

            $payload = normalizeRoutePayload((array) $request->getParsedBody());
            $route   = RouteRepository::updateRoute($routeId, $payload);
            return json_ok($response, $route);
        });

        $group->get('/airline-stats', function (Request $request, Response $response): Response {
            $stats = AirlineStatsRepository::getStats();
            if (!$stats) return json_error($response, 'Airline stats not found', 404);
            return json_ok($response, $stats);
        });

        $group->put('/airline-stats', function (Request $request, Response $response): Response {
            $allowed = ['totalFlights','totalHours','activeMembers','foundedDate','division','callsignPrefix'];
            $body    = (array) $request->getParsedBody();
            $patch   = [];
            foreach ($allowed as $key) {
                if (array_key_exists($key, $body)) $patch[$key] = $body[$key];
            }
            if (!$patch) return json_error($response, 'No valid fields provided', 400);
            return json_ok($response, AirlineStatsRepository::updateStats($patch));
        });

    })->add(new AdminMiddleware());

};

function normalizeRoutePayload(array $body): array
{
    $fromAirport = strtoupper(trim((string) ($body['fromAirport'] ?? $body['from'] ?? '')));
    $toAirport   = strtoupper(trim((string) ($body['toAirport']   ?? $body['to']   ?? '')));
    $hubAirport  = strtoupper(trim((string) ($body['hubAirport']  ?? $body['hub']  ?? '')));
    $status      = strtolower(trim((string) ($body['status'] ?? 'active')));
    $rawId       = $body['aircraftId'] ?? null;
    $aircraftId  = ($rawId === '' || $rawId === null) ? null : (int) $rawId;

    $schedulesSource = (isset($body['schedules']) && is_array($body['schedules']) && $body['schedules'])
        ? $body['schedules']
        : [['flightNumber' => $body['flightNumber'] ?? null, 'slotCode' => $body['slotCode'] ?? null, 'departureTime' => $body['departureTime'] ?? null, 'active' => $body['scheduleActive'] ?? true]];

    $schedules = array_filter($schedulesSource, fn($s) =>
        !empty($s['flightNumber']) || !empty($s['departureTime']) || !empty($s['slotCode'])
    );
    $schedules = array_map(fn($s) => [
        'flightNumber'  => $s['flightNumber'] ?? null,
        'slotCode'      => $s['slotCode'] ?? null,
        'departureTime' => $s['departureTime'] ?? null,
        'active'        => $s['active'] ?? true,
    ], $schedules);

    if (!$fromAirport || !$toAirport || !$hubAirport) {
        throw new \RuntimeException('fromAirport, toAirport and hubAirport are required.', 400);
    }
    if (!in_array($status, ['active', 'inactive'], true)) {
        throw new \RuntimeException('Route status must be active or inactive.', 400);
    }

    return [
        'fromAirport' => $fromAirport,
        'toAirport'   => $toAirport,
        'hubAirport'  => $hubAirport,
        'aircraftId'  => $aircraftId,
        'status'      => $status,
        'schedules'   => array_values($schedules),
    ];
}

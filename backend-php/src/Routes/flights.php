<?php

declare(strict_types=1);

use AFV\Helpers\PricingHelper;
use AFV\Repositories\AirportRepository;
use AFV\Repositories\BookingRepository;
use AFV\Repositories\RouteRepository;
use AFV\Services\FlightSearchService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;

return function (App $app): void {

    $app->get('/api/flights/search', function (Request $request, Response $response): Response {
        $params = $request->getQueryParams();
        $from   = strtoupper(trim((string) ($params['from'] ?? '')));
        $to     = strtoupper(trim((string) ($params['to']   ?? '')));
        $date   = $params['date']       ?? null;
        $pax    = max(1, (int) ($params['passengers'] ?? 1));

        if (!$from || !$to) return json_error($response, 'from and to are required', 400);

        $result = FlightSearchService::searchItineraries($from, $to, $date ?: null, $pax);
        return json_ok($response, $result);
    });

    $app->get('/api/flights/routes', function (Request $request, Response $response): Response {
        $routes   = RouteRepository::listRoutes();
        $airports = AirportRepository::getAll();

        $result = [];
        foreach ($routes as $route) {
            if ($route['status'] !== 'active') continue;
            $fromAp = $airports[$route['fromAirport']] ?? null;
            $toAp   = $airports[$route['toAirport']]   ?? null;
            $hubAp  = $airports[$route['hubAirport']]  ?? null;

            $result[] = [
                'from'       => $route['fromAirport'],
                'to'         => $route['toAirport'],
                'fromIata'   => $fromAp['iata']  ?? $route['fromAirport'],
                'toIata'     => $toAp['iata']    ?? $route['toAirport'],
                'fromCity'   => $fromAp['city']  ?? $route['fromAirport'],
                'toCity'     => $toAp['city']    ?? $route['toAirport'],
                'fromCoords' => $fromAp ? [$fromAp['lat'], $fromAp['lon']] : null,
                'toCoords'   => $toAp   ? [$toAp['lat'],   $toAp['lon']]   : null,
                'distanceKm' => $route['distanceKm'],
                'hub'        => $route['hubAirport'],
                'hubIata'    => $hubAp['iata'] ?? $route['hubAirport'],
            ];
        }

        return json_ok($response, $result);
    });

    $app->get('/api/flights/airports', function (Request $request, Response $response): Response {
        return json_ok($response, AirportRepository::getAll());
    });

    $app->post('/api/flights/itinerary', function (Request $request, Response $response): Response {
        $body       = (array) $request->getParsedBody();
        $itinerary  = $body['itinerary']  ?? null;
        $passengers = max(1, (int) ($body['passengers'] ?? 1));

        $hydrated   = FlightSearchService::validateAndHydrateItinerary((array) $itinerary);
        $destination = $hydrated['to'] ?? null;

        $pricesPerPerson = ['economy' => 0, 'business' => 0, 'first' => 0];
        foreach ($hydrated['segments'] as $seg) {
            $segDate = \DateTime::createFromFormat('Y-m-d H:i:s', $seg['departureDate'] . ' 12:00:00');
            $prices  = PricingHelper::allClassPrices((int) $seg['distanceKm'], $segDate, 0.6, $destination);
            $pricesPerPerson['economy']  += $prices['economy']['perPerson'];
            $pricesPerPerson['business'] += $prices['business']['perPerson'];
            $pricesPerPerson['first']    += $prices['first']['perPerson'];
        }

        return json_ok($response, array_merge($hydrated, [
            'pricesPerPerson' => $pricesPerPerson,
            'prices'          => [
                'economy'  => $pricesPerPerson['economy']  * $passengers,
                'business' => $pricesPerPerson['business'] * $passengers,
                'first'    => $pricesPerPerson['first']    * $passengers,
            ],
        ]));
    });

    $app->get('/api/flights/pricing-factors', function (Request $request, Response $response): Response {
        $dateStr = $request->getQueryParams()['date'] ?? null;
        $date    = $dateStr ? new \DateTime($dateStr) : new \DateTime();
        return json_ok($response, PricingHelper::getPricingFactors($date));
    });

    $app->post('/api/flights/seat-map', function (Request $request, Response $response): Response {
        $body       = (array) $request->getParsedBody();
        $itinerary  = $body['itinerary']   ?? null;
        $cabinClass = $body['cabinClass']  ?? '';

        if (!$itinerary || empty($itinerary['segments'])) {
            return json_error($response, 'A valid itinerary is required', 400);
        }
        if (!in_array($cabinClass, ['economy', 'business', 'first'], true)) {
            return json_error($response, 'A valid cabin class is required', 400);
        }

        $occupied = BookingRepository::getOccupiedSeats($itinerary['segments'], $cabinClass);
        return json_ok($response, ['occupiedSeats' => $occupied]);
    });

};

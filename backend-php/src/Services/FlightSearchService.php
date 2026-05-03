<?php

declare(strict_types=1);

namespace AFV\Services;

use AFV\Helpers\ItineraryHelper;
use AFV\Helpers\PricingHelper;
use AFV\Repositories\AirportRepository;
use AFV\Repositories\RouteRepository;

class FlightSearchService
{
    private const MIN_LAYOVER_MINUTES = 90;
    private const MAX_LEGS            = 3;

    public static function searchItineraries(string $from, string $to, ?string $date, int $passengers = 1): array
    {
        $airports    = AirportRepository::getAll();
        $origin      = $airports[$from] ?? null;
        $destination = $airports[$to]   ?? null;

        if (!$origin || !$destination) {
            throw new \RuntimeException('Airport not found', 404);
        }

        if (!$date) {
            $d    = new \DateTime();
            $d->modify('+7 days');
            $date = $d->format('Y-m-d');
        }

        $routes       = RouteRepository::getRoutesWithSchedules();
        $activeRoutes = array_filter($routes, fn($r) => $r['status'] === 'active');
        $byOrigin     = self::groupByOrigin(array_values($activeRoutes));

        $candidatePaths = self::findAllPaths($from, $to, $byOrigin);
        $itineraries    = [];
        foreach ($candidatePaths as $path) {
            $built = self::buildItinerariesForPath($path, $date, $passengers);
            foreach ($built as $it) $itineraries[] = $it;
        }

        usort($itineraries, function ($a, $b) {
            if ($a['stopCount'] !== $b['stopCount']) return $a['stopCount'] - $b['stopCount'];
            return $a['pricesPerPerson']['economy'] - $b['pricesPerPerson']['economy'];
        });

        return [
            'origin'        => $origin,
            'destination'   => $destination,
            'travelDate'    => $date,
            'itineraries'   => array_slice($itineraries, 0, 8),
            'searchSummary' => [
                'stopsOffered' => !empty(array_filter($itineraries, fn($it) => $it['stopCount'] > 0)),
                'totalResults' => count($itineraries),
            ],
        ];
    }

    public static function validateAndHydrateItinerary(array $rawItinerary): array
    {
        if (empty($rawItinerary['segments']) || !is_array($rawItinerary['segments'])) {
            throw new \RuntimeException('A valid itinerary is required', 400);
        }

        $flightNumbers    = array_column($rawItinerary['segments'], 'flightNumber');
        $definitions      = RouteRepository::getSchedulesByFlightNumbers($flightNumbers);
        $definitionsByFn  = [];
        foreach ($definitions as $def) {
            $definitionsByFn[$def['schedule']['flightNumber']] = $def;
        }

        if (count($definitionsByFn) !== count($flightNumbers)) {
            throw new \RuntimeException('One or more flight segments are no longer available', 409);
        }

        $previousArrival   = null;
        $hydratedSegments  = [];

        foreach ($rawItinerary['segments'] as $idx => $seg) {
            $def = $definitionsByFn[$seg['flightNumber']];
            if ($idx === 0) {
                $depDT = ItineraryHelper::combineDateAndTime($seg['departureDate'], $def['schedule']['departureTime']);
            } else {
                $depDT = self::resolveSequentialDeparture($previousArrival, $def['schedule']['departureTime']);
            }
            $arrDT           = ItineraryHelper::addMinutes($depDT, $def['durationMinutes']);
            $previousArrival = $arrDT;

            $hydratedSegments[] = [
                'routeId'           => $def['routeId'],
                'flightNumber'      => $def['schedule']['flightNumber'],
                'from'              => $def['fromAirport'],
                'to'                => $def['toAirport'],
                'departureDate'     => ItineraryHelper::formatIsoDate($depDT),
                'arrivalDate'       => ItineraryHelper::formatIsoDate($arrDT),
                'departure'         => ItineraryHelper::formatDisplayTime($depDT),
                'arrival'           => ItineraryHelper::formatDisplayTime($arrDT, $depDT),
                'departureDateTime' => $depDT->format('c'),
                'arrivalDateTime'   => $arrDT->format('c'),
                'durationMinutes'   => $def['durationMinutes'],
                'duration'          => ItineraryHelper::formatDurationMinutes($def['durationMinutes']),
                'distanceKm'        => $def['distanceKm'],
                'aircraft'          => $def['aircraft'],
            ];
        }

        $first        = $hydratedSegments[0];
        $last         = end($hydratedSegments);
        $totalMinutes = (strtotime($last['arrivalDateTime']) - strtotime($first['departureDateTime'])) / 60;

        return [
            'itineraryId'     => $rawItinerary['itineraryId'] ?? self::buildItineraryId($hydratedSegments),
            'stopCount'       => max(0, count($hydratedSegments) - 1),
            'summary'         => count($hydratedSegments) > 1
                ? (count($hydratedSegments) - 1) . ' stop' . (count($hydratedSegments) > 2 ? 's' : '')
                : 'Non-stop',
            'durationMinutes' => (int) round($totalMinutes),
            'duration'        => ItineraryHelper::formatDurationMinutes($totalMinutes),
            'segments'        => $hydratedSegments,
            'from'            => $first['from'],
            'to'              => $last['to'],
            'date'            => $first['departureDate'],
        ];
    }

    // ── BFS path finder ───────────────────────────────────────────────────────

    private static function findAllPaths(string $from, string $to, array $byOrigin): array
    {
        $paths = [];
        $queue = [[$from, [], [$from => true]]];

        while ($queue && count($paths) < 50) {
            [$current, $pathSoFar, $visited] = array_shift($queue);

            foreach ($byOrigin[$current] ?? [] as $route) {
                $next    = $route['toAirport'];
                $newPath = array_merge($pathSoFar, [$route]);

                if ($next === $to) {
                    $paths[] = $newPath;
                } elseif (count($newPath) < self::MAX_LEGS && !isset($visited[$next])) {
                    $newVisited        = $visited;
                    $newVisited[$next] = true;
                    $queue[]           = [$next, $newPath, $newVisited];
                }
            }
        }

        return $paths;
    }

    private static function groupByOrigin(array $routes): array
    {
        $map = [];
        foreach ($routes as $route) {
            $map[$route['fromAirport']][] = $route;
        }
        return $map;
    }

    // ── Itinerary builders ────────────────────────────────────────────────────

    private static function buildItinerariesForPath(array $path, string $travelDate, int $passengers): array
    {
        if (count($path) === 1) {
            $route  = $path[0];
            $result = [];
            foreach ($route['schedules'] as $schedule) {
                if ($schedule['active']) {
                    $result[] = self::buildDirectItinerary($route, $schedule, $travelDate, $passengers);
                }
            }
            return $result;
        }

        $results = [];
        foreach ($path[0]['schedules'] as $firstSchedule) {
            if (!$firstSchedule['active']) continue;
            $it = self::buildMultiLegItinerary($path, $firstSchedule, $travelDate, $passengers);
            if ($it) $results[] = $it;
        }
        return $results;
    }

    private static function buildDirectItinerary(array $route, array $schedule, string $travelDate, int $passengers): array
    {
        $depDT   = ItineraryHelper::combineDateAndTime($travelDate, $schedule['departureTime']);
        $arrDT   = ItineraryHelper::addMinutes($depDT, (int) $route['durationMinutes']);
        $segment = self::createSegment($route, $schedule['flightNumber'], $depDT, $arrDT);

        $pricesPerPerson = self::buildPrices([$segment]);

        return [
            'itineraryId'     => self::buildItineraryId([$segment]),
            'stopCount'       => 0,
            'summary'         => 'Non-stop',
            'durationMinutes' => (int) $route['durationMinutes'],
            'duration'        => ItineraryHelper::formatDurationMinutes((int) $route['durationMinutes']),
            'layoverMinutes'  => 0,
            'segments'        => [$segment],
            'pricesPerPerson' => $pricesPerPerson,
            'prices'          => self::multiplyPrices($pricesPerPerson, $passengers),
            'from'            => $route['fromAirport'],
            'to'              => $route['toAirport'],
            'date'            => $segment['departureDate'],
        ];
    }

    private static function buildMultiLegItinerary(array $routes, array $firstSchedule, string $travelDate, int $passengers): ?array
    {
        $airports = AirportRepository::getAll();
        $segments = [];

        $firstDep = ItineraryHelper::combineDateAndTime($travelDate, $firstSchedule['departureTime']);
        $firstArr = ItineraryHelper::addMinutes($firstDep, (int) $routes[0]['durationMinutes']);
        $segments[] = self::createSegment($routes[0], $firstSchedule['flightNumber'], $firstDep, $firstArr);

        for ($i = 1; $i < count($routes); $i++) {
            $prevArr        = new \DateTime($segments[$i - 1]['arrivalDateTime']);
            $activeSchedules = array_filter($routes[$i]['schedules'], fn($s) => $s['active']);
            $connection     = self::pickConnection($prevArr, array_values($activeSchedules));
            if (!$connection) return null;

            $legArr   = ItineraryHelper::addMinutes($connection['departureDateTime'], (int) $routes[$i]['durationMinutes']);
            $segments[] = self::createSegment($routes[$i], $connection['flightNumber'], $connection['departureDateTime'], $legArr);
        }

        $firstSeg  = $segments[0];
        $lastSeg   = end($segments);
        $totalMins = (strtotime($lastSeg['arrivalDateTime']) - strtotime($firstSeg['departureDateTime'])) / 60;
        $stopCount = count($segments) - 1;

        $layoverMins = 0;
        for ($i = 1; $i < count($segments); $i++) {
            $layoverMins += (strtotime($segments[$i]['departureDateTime']) - strtotime($segments[$i - 1]['arrivalDateTime'])) / 60;
        }

        $stopCities = [];
        for ($i = 0; $i < count($segments) - 1; $i++) {
            $stopCities[] = $airports[$segments[$i]['to']]['city'] ?? $segments[$i]['to'];
        }
        $summary = $stopCount === 1
            ? "1 stop in {$stopCities[0]}"
            : "{$stopCount} stops via " . implode(', ', $stopCities);

        $pricesPerPerson = self::buildPrices($segments);

        return [
            'itineraryId'     => self::buildItineraryId($segments),
            'stopCount'       => $stopCount,
            'summary'         => $summary,
            'durationMinutes' => (int) round($totalMins),
            'duration'        => ItineraryHelper::formatDurationMinutes($totalMins),
            'layoverMinutes'  => (int) round($layoverMins),
            'layover'         => ItineraryHelper::formatDurationMinutes($layoverMins),
            'segments'        => $segments,
            'pricesPerPerson' => $pricesPerPerson,
            'prices'          => self::multiplyPrices($pricesPerPerson, $passengers),
            'from'            => $firstSeg['from'],
            'to'              => $lastSeg['to'],
            'date'            => $firstSeg['departureDate'],
        ];
    }

    private static function resolveSequentialDeparture(\DateTime $previousArrival, string $departureTime): \DateTime
    {
        $earliest       = ItineraryHelper::addMinutes($previousArrival, self::MIN_LAYOVER_MINUTES);
        $sameDayDate    = ItineraryHelper::formatIsoDate($earliest);
        $sameDayCandidate = ItineraryHelper::combineDateAndTime($sameDayDate, $departureTime);

        if ($sameDayCandidate >= $earliest) return $sameDayCandidate;

        $nextDay = clone $earliest;
        $nextDay->modify('+1 day');
        return ItineraryHelper::combineDateAndTime(ItineraryHelper::formatIsoDate($nextDay), $departureTime);
    }

    private static function pickConnection(\DateTime $prevArrival, array $schedules): ?array
    {
        $earliest = ItineraryHelper::addMinutes($prevArrival, self::MIN_LAYOVER_MINUTES);
        usort($schedules, fn($a, $b) =>
            ItineraryHelper::timeStringToMinutes($a['departureTime']) - ItineraryHelper::timeStringToMinutes($b['departureTime'])
        );

        $searchDate = ItineraryHelper::formatIsoDate($earliest);

        for ($day = 0; $day < 2; $day++) {
            foreach ($schedules as $schedule) {
                $depDT = ItineraryHelper::combineDateAndTime($searchDate, $schedule['departureTime']);
                if ($depDT >= $earliest) {
                    return ['flightNumber' => $schedule['flightNumber'], 'departureDateTime' => $depDT];
                }
            }
            $next = clone $earliest;
            $next->modify('+' . ($day + 1) . ' day');
            $searchDate = ItineraryHelper::formatIsoDate($next);
        }

        return null;
    }

    private static function createSegment(array $route, string $flightNumber, \DateTime $depDT, \DateTime $arrDT): array
    {
        return [
            'routeId'           => $route['id'],
            'flightNumber'      => $flightNumber,
            'from'              => $route['fromAirport'],
            'to'                => $route['toAirport'],
            'departureDate'     => ItineraryHelper::formatIsoDate($depDT),
            'arrivalDate'       => ItineraryHelper::formatIsoDate($arrDT),
            'departure'         => ItineraryHelper::formatDisplayTime($depDT),
            'arrival'           => ItineraryHelper::formatDisplayTime($arrDT, $depDT),
            'departureDateTime' => $depDT->format('c'),
            'arrivalDateTime'   => $arrDT->format('c'),
            'durationMinutes'   => (int) $route['durationMinutes'],
            'duration'          => ItineraryHelper::formatDurationMinutes((int) $route['durationMinutes']),
            'distanceKm'        => (int) $route['distanceKm'],
            'aircraft'          => $route['aircraft'],
        ];
    }

    private static function buildPrices(array $segments): array
    {
        $available = ['economy' => true, 'business' => true, 'first' => true];

        foreach ($segments as $seg) {
            $seats = $seg['aircraft']['seats'] ?? null;
            if (!$seats) continue;
            if (empty($seats['business']))  $available['business'] = false;
            if (empty($seats['first']))     $available['first']    = false;
        }

        $totals = [];
        foreach ($segments as $seg) {
            $segDate = \DateTime::createFromFormat('Y-m-d H:i:s', $seg['departureDate'] . ' 12:00:00');
            $prices  = PricingHelper::allClassPrices((int) $seg['distanceKm'], $segDate);

            if ($available['economy'])  $totals['economy']  = ($totals['economy']  ?? 0) + $prices['economy']['perPerson'];
            if ($available['business']) $totals['business'] = ($totals['business'] ?? 0) + $prices['business']['perPerson'];
            if ($available['first'])    $totals['first']    = ($totals['first']    ?? 0) + $prices['first']['perPerson'];
        }

        return [
            'economy'  => $totals['economy']  ?? 0,
            'business' => $available['business'] ? ($totals['business'] ?? 0) : null,
            'first'    => $available['first']    ? ($totals['first']    ?? 0) : null,
        ];
    }

    private static function multiplyPrices(array $pricesPerPerson, int $passengers): array
    {
        return [
            'economy'  => ($pricesPerPerson['economy']  ?? 0) * $passengers,
            'business' => ($pricesPerPerson['business'] !== null ? $pricesPerPerson['business'] * $passengers : null),
            'first'    => ($pricesPerPerson['first']    !== null ? $pricesPerPerson['first']    * $passengers : null),
        ];
    }

    private static function buildItineraryId(array $segments): string
    {
        return implode('__', array_map(fn($s) => "{$s['flightNumber']}_{$s['departureDate']}", $segments));
    }
}

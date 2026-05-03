<?php

declare(strict_types=1);

namespace AFV\Repositories;

use AFV\Helpers\DistanceHelper;

class RouteRepository
{
    // ── Map helpers ───────────────────────────────────────────────────────────

    private static function mapAircraftSummary(array $row): ?array
    {
        if (empty($row['aircraft_id'])) return null;
        return [
            'id'           => $row['aircraft_id'],
            'registration' => $row['registration'],
            'type'         => $row['type'],
            'category'     => $row['category'],
            'hub'          => $row['hub'],
            'hubName'      => $row['hub_name'],
            'seats'        => [
                'economy'  => $row['economy_seats'],
                'business' => $row['business_seats'],
                'first'    => $row['first_seats'],
            ],
        ];
    }

    private static function mapAirportSummary(?string $icao, ?string $name, ?string $city, ?string $country): ?array
    {
        if (!$icao) return null;
        return ['icao' => $icao, 'name' => $name, 'city' => $city, 'country' => $country];
    }

    private static function mapRouteRows(array $rows): array
    {
        $grouped = [];
        foreach ($rows as $row) {
            $id = $row['id'];
            if (!isset($grouped[$id])) {
                $grouped[$id] = [
                    'id'                 => $row['id'],
                    'fromAirport'        => $row['from_airport'],
                    'toAirport'          => $row['to_airport'],
                    'hubAirport'         => $row['hub_airport'],
                    'distanceKm'         => $row['distance_km'],
                    'durationMinutes'    => $row['duration_minutes'],
                    'status'             => $row['status'],
                    'aircraftId'         => $row['aircraft_id'],
                    'aircraft'           => self::mapAircraftSummary($row),
                    'fromAirportDetails' => self::mapAirportSummary($row['from_airport'], $row['from_airport_name'], $row['from_city'], $row['from_country']),
                    'toAirportDetails'   => self::mapAirportSummary($row['to_airport'],   $row['to_airport_name'],   $row['to_city'],   $row['to_country']),
                    'hubAirportDetails'  => self::mapAirportSummary($row['hub_airport'],  $row['hub_airport_name'],  $row['hub_city'],  $row['hub_country']),
                    'schedules'          => [],
                ];
            }

            if ($row['schedule_id']) {
                $grouped[$id]['schedules'][] = [
                    'id'            => $row['schedule_id'],
                    'flightNumber'  => $row['flight_number'],
                    'slotCode'      => $row['slot_code'],
                    'departureTime' => $row['departure_time'],
                    'active'        => (bool) $row['schedule_active'],
                ];
            }
        }
        return array_values($grouped);
    }

    private static function fetchRoutes(string $whereClause = '', array $values = []): array
    {
        $stmt = Database::getConnection()->prepare(
            "SELECT
                r.id, r.from_airport, r.to_airport, r.hub_airport, r.distance_km, r.duration_minutes, r.status,
                a.id AS aircraft_id, a.registration, a.type, a.category, a.hub, a.hub_name,
                a.economy_seats, a.business_seats, a.first_seats,
                af.name AS from_airport_name, af.city AS from_city, af.country AS from_country,
                at.name AS to_airport_name,   at.city AS to_city,   at.country AS to_country,
                ah.name AS hub_airport_name,  ah.city AS hub_city,  ah.country AS hub_country,
                s.id AS schedule_id, s.flight_number, s.slot_code,
                TIME_FORMAT(s.departure_time, '%H:%i:%s') AS departure_time,
                s.active AS schedule_active
              FROM routes r
              LEFT JOIN aircraft a  ON a.id    = r.aircraft_id
              LEFT JOIN airports af ON af.icao = r.from_airport
              LEFT JOIN airports at ON at.icao = r.to_airport
              LEFT JOIN airports ah ON ah.icao = r.hub_airport
              LEFT JOIN route_schedules s ON s.route_id = r.id
              {$whereClause}
              ORDER BY r.id ASC, s.departure_time ASC"
        );
        $stmt->execute($values);
        return self::mapRouteRows($stmt->fetchAll());
    }

    public static function getRoutesWithSchedules(): array
    {
        return self::fetchRoutes();
    }

    public static function getRouteById(int $routeId): ?array
    {
        $routes = self::fetchRoutes('WHERE r.id = ?', [$routeId]);
        return $routes[0] ?? null;
    }

    public static function listRoutes(): array
    {
        $rows = Database::getConnection()->query(
            "SELECT id, from_airport, to_airport, hub_airport, distance_km, duration_minutes, aircraft_id, status FROM routes ORDER BY from_airport ASC, to_airport ASC"
        )->fetchAll();

        return array_map(fn($r) => [
            'id'              => $r['id'],
            'fromAirport'     => $r['from_airport'],
            'toAirport'       => $r['to_airport'],
            'hubAirport'      => $r['hub_airport'],
            'distanceKm'      => $r['distance_km'],
            'durationMinutes' => $r['duration_minutes'],
            'aircraftId'      => $r['aircraft_id'],
            'status'          => $r['status'],
        ], $rows);
    }

    public static function getSchedulesByFlightNumbers(array $flightNumbers): array
    {
        if (!$flightNumbers) return [];

        $placeholders = implode(', ', array_fill(0, count($flightNumbers), '?'));
        $stmt         = Database::getConnection()->prepare(
            "SELECT
                r.id, r.from_airport, r.to_airport, r.hub_airport, r.distance_km, r.duration_minutes,
                a.id AS aircraft_id, a.registration, a.type, a.category, a.hub, a.hub_name,
                a.economy_seats, a.business_seats, a.first_seats,
                s.id AS schedule_id, s.flight_number, s.slot_code,
                TIME_FORMAT(s.departure_time, '%H:%i:%s') AS departure_time,
                s.active AS schedule_active
              FROM route_schedules s
              INNER JOIN routes r ON r.id = s.route_id
              LEFT JOIN aircraft a ON a.id = r.aircraft_id
              WHERE s.flight_number IN ({$placeholders})"
        );
        $stmt->execute($flightNumbers);

        return array_map(fn($row) => [
            'routeId'         => $row['id'],
            'fromAirport'     => $row['from_airport'],
            'toAirport'       => $row['to_airport'],
            'hubAirport'      => $row['hub_airport'],
            'distanceKm'      => (int) $row['distance_km'],
            'durationMinutes' => (int) $row['duration_minutes'],
            'aircraft'        => self::mapAircraftSummary($row),
            'schedule'        => [
                'id'            => $row['schedule_id'],
                'flightNumber'  => $row['flight_number'],
                'slotCode'      => $row['slot_code'],
                'departureTime' => $row['departure_time'],
                'active'        => (bool) $row['schedule_active'],
            ],
        ], $stmt->fetchAll());
    }

    // ── Write operations ──────────────────────────────────────────────────────

    private static function normalizeSchedules(array $schedules): array
    {
        if (!$schedules) {
            throw new \RuntimeException('At least one route schedule is required.', 400);
        }

        return array_map(function ($schedule, $index) {
            $flightNumber = strtoupper(trim((string) ($schedule['flightNumber'] ?? '')));
            if (!$flightNumber) {
                throw new \RuntimeException("Schedule " . ($index + 1) . " is missing a flight number.", 400);
            }

            $dt = trim((string) ($schedule['departureTime'] ?? ''));
            if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $dt)) {
                throw new \RuntimeException('Departure time must use HH:MM or HH:MM:SS format.', 400);
            }
            if (strlen($dt) === 5) $dt .= ':00';

            return [
                'flightNumber'  => $flightNumber,
                'slotCode'      => strtolower(trim((string) ($schedule['slotCode'] ?? "slot-" . ($index + 1)))),
                'departureTime' => $dt,
                'active'        => isset($schedule['active']) ? (bool) $schedule['active'] : true,
            ];
        }, $schedules, array_keys($schedules));
    }

    private static function calculateRouteMetrics(string $from, string $to, ?string $hub, ?int $aircraftId): array
    {
        $airports = AirportRepository::getAll();
        $origin   = $airports[$from] ?? null;
        $dest     = $airports[$to]   ?? null;

        if (!$origin || !$dest) {
            throw new \RuntimeException('One or more airports do not exist.', 400);
        }
        if ($hub && !isset($airports[$hub])) {
            throw new \RuntimeException('The selected hub airport does not exist.', 400);
        }
        if ($from === $to) {
            throw new \RuntimeException('Origin and destination must be different airports.', 400);
        }

        $distanceKm = DistanceHelper::haversineDistance($origin['lat'], $origin['lon'], $dest['lat'], $dest['lon']);

        $durationMinutes = DistanceHelper::estimateDurationMinutes($distanceKm);
        if ($aircraftId) {
            $row = Database::getConnection()->prepare("SELECT cruise_speed_kmh FROM aircraft WHERE id = ? LIMIT 1");
            $row->execute([$aircraftId]);
            $speed = (int) ($row->fetchColumn() ?: 0);
            if ($speed > 0) {
                $extra           = $distanceKm < 1000 ? 45 : 30;
                $durationMinutes = (int) round(($distanceKm / $speed) * 60) + $extra;
            }
        }

        return ['distanceKm' => $distanceKm, 'durationMinutes' => $durationMinutes];
    }

    private static function replaceSchedules(\PDO $pdo, int $routeId, array $schedules): void
    {
        $del = $pdo->prepare("DELETE FROM route_schedules WHERE route_id = ?");
        $del->execute([$routeId]);

        $ins = $pdo->prepare(
            "INSERT INTO route_schedules (route_id, flight_number, slot_code, departure_time, active) VALUES (?, ?, ?, ?, ?)"
        );
        foreach ($schedules as $s) {
            $ins->execute([$routeId, $s['flightNumber'], $s['slotCode'], $s['departureTime'], $s['active'] ? 1 : 0]);
        }
    }

    private static function coerceWriteError(\Throwable $e): \Throwable
    {
        if ($e->getCode() === '23000' || strpos($e->getMessage(), 'Duplicate') !== false) {
            if (strpos($e->getMessage(), 'uq_route_pair') !== false) {
                throw new \RuntimeException('A route for that airport pair already exists.', 409);
            }
            if (strpos($e->getMessage(), 'flight_number') !== false) {
                throw new \RuntimeException('That flight number is already assigned to another route.', 409);
            }
        }
        if (strpos($e->getMessage(), 'a foreign key constraint fails') !== false) {
            throw new \RuntimeException('The selected aircraft does not exist.', 400);
        }
        return $e;
    }

    public static function createRoute(array $payload): array
    {
        $schedules = self::normalizeSchedules($payload['schedules'] ?? []);
        $metrics   = self::calculateRouteMetrics(
            $payload['fromAirport'], $payload['toAirport'],
            $payload['hubAirport'] ?? null, $payload['aircraftId'] ?? null
        );

        $pdo = Database::getConnection();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                "INSERT INTO routes (from_airport, to_airport, hub_airport, distance_km, duration_minutes, aircraft_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $payload['fromAirport'], $payload['toAirport'], $payload['hubAirport'],
                $metrics['distanceKm'], $metrics['durationMinutes'],
                $payload['aircraftId'] ?? null, $payload['status'] ?? 'active',
            ]);
            $routeId = (int) $pdo->lastInsertId();
            self::replaceSchedules($pdo, $routeId, $schedules);
            $pdo->commit();
            return self::getRouteById($routeId);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw self::coerceWriteError($e);
        }
    }

    public static function updateRoute(int $routeId, array $payload): array
    {
        $schedules = self::normalizeSchedules($payload['schedules'] ?? []);
        $metrics   = self::calculateRouteMetrics(
            $payload['fromAirport'], $payload['toAirport'],
            $payload['hubAirport'] ?? null, $payload['aircraftId'] ?? null
        );

        $pdo = Database::getConnection();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                "UPDATE routes SET from_airport=?, to_airport=?, hub_airport=?, distance_km=?, duration_minutes=?, aircraft_id=?, status=? WHERE id=?"
            );
            $stmt->execute([
                $payload['fromAirport'], $payload['toAirport'], $payload['hubAirport'],
                $metrics['distanceKm'], $metrics['durationMinutes'],
                $payload['aircraftId'] ?? null, $payload['status'] ?? 'active', $routeId,
            ]);
            self::replaceSchedules($pdo, $routeId, $schedules);
            $pdo->commit();
            return self::getRouteById($routeId);
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw self::coerceWriteError($e);
        }
    }
}

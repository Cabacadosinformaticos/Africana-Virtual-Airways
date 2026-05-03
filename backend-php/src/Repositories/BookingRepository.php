<?php

declare(strict_types=1);

namespace AFV\Repositories;

use AFV\Helpers\ItineraryHelper;

class BookingRepository
{
    private static function mapBooking(?array $row): ?array
    {
        if (!$row) return null;
        $date = $row['travel_date'];
        if ($date instanceof \DateTime) $date = $date->format('Y-m-d');

        return [
            'id'               => $row['id'],
            'bookingRef'       => $row['booking_ref'],
            'userId'           => $row['user_id'],
            'userName'         => $row['user_name'],
            'passengerEmail'   => $row['passenger_email'],
            'flightNumber'     => $row['flight_number'],
            'from'             => $row['from_airport'],
            'to'               => $row['to_airport'],
            'date'             => (string) $date,
            'cabinClass'       => $row['cabin_class'],
            'passengers'       => $row['passengers'],
            'totalPrice'       => (float) $row['total_price'],
            'status'           => $row['status'],
            'seat'             => $row['seat_selection'],
            'passengerDetails' => ItineraryHelper::parseJsonField($row['passenger_details'], []),
            'itinerary'        => ItineraryHelper::parseJsonField($row['itinerary'], ['segments' => []]),
            'createdAt'        => $row['created_at'],
            'updatedAt'        => $row['updated_at'],
            'cancelledAt'      => $row['cancelled_at'],
        ];
    }

    private static function mapPassenger(array $row): array
    {
        return [
            'firstName'   => $row['first_name'],
            'lastName'    => $row['last_name'],
            'email'       => $row['email'],
            'phone'       => $row['phone'] ?? '',
            'nationality' => $row['nationality'] ?? '',
            'seat'        => $row['seat_selection'] ?? null,
        ];
    }

    private static function mapSegment(array $row): array
    {
        $depDt = $row['departure_datetime'];
        $arrDt = $row['arrival_datetime'];
        if ($depDt instanceof \DateTime) $depDt = $depDt->format('c');
        if ($arrDt instanceof \DateTime) $arrDt = $arrDt->format('c');

        return [
            'routeId'           => $row['route_id'],
            'flightNumber'      => $row['flight_number'],
            'from'              => $row['from_airport'],
            'to'                => $row['to_airport'],
            'departureDate'     => (string) $row['departure_date'],
            'arrivalDate'       => (string) $row['arrival_date'],
            'departure'         => $row['departure_time'],
            'arrival'           => $row['arrival_time'],
            'departureDateTime' => (string) $depDt,
            'arrivalDateTime'   => (string) $arrDt,
            'durationMinutes'   => (int) ($row['duration_minutes'] ?? 0),
            'distanceKm'        => (int) ($row['distance_km'] ?? 0),
            'aircraft'          => ($row['aircraft_id'] || $row['aircraft_registration'] || $row['aircraft_type'])
                ? ['id' => $row['aircraft_id'] ?? null, 'registration' => $row['aircraft_registration'] ?? null, 'type' => $row['aircraft_type'] ?? null]
                : null,
        ];
    }

    private static function hydrateBookings(array $bookings): array
    {
        if (!$bookings) return $bookings;

        $ids          = array_filter(array_column($bookings, 'id'));
        if (!$ids) return $bookings;

        $placeholders = implode(', ', array_fill(0, count($ids), '?'));

        $pStmt = Database::getConnection()->prepare(
            "SELECT booking_id, passenger_index, first_name, last_name, email, phone, nationality, seat_selection
             FROM booking_passengers WHERE booking_id IN ({$placeholders}) ORDER BY booking_id ASC, passenger_index ASC"
        );
        $pStmt->execute($ids);
        $passengerRows = $pStmt->fetchAll();

        $sStmt = Database::getConnection()->prepare(
            "SELECT booking_id, segment_index, route_id, flight_number, from_airport, to_airport,
                    departure_date, arrival_date, departure_time, arrival_time,
                    departure_datetime, arrival_datetime, duration_minutes, distance_km,
                    aircraft_id, aircraft_registration, aircraft_type
             FROM booking_segments WHERE booking_id IN ({$placeholders}) ORDER BY booking_id ASC, segment_index ASC"
        );
        $sStmt->execute($ids);
        $segmentRows = $sStmt->fetchAll();

        $passengersByBooking = [];
        foreach ($passengerRows as $r) {
            $passengersByBooking[$r['booking_id']][] = self::mapPassenger($r);
        }

        $segmentsByBooking = [];
        foreach ($segmentRows as $r) {
            $segmentsByBooking[$r['booking_id']][] = self::mapSegment($r);
        }

        foreach ($bookings as &$booking) {
            if (!empty($passengersByBooking[$booking['id']])) {
                $booking['passengerDetails'] = $passengersByBooking[$booking['id']];
            }
            if (!empty($segmentsByBooking[$booking['id']])) {
                $booking['itinerary'] = array_merge($booking['itinerary'] ?? [], ['segments' => $segmentsByBooking[$booking['id']]]);
            }
        }
        unset($booking);

        return $bookings;
    }

    public static function create(array $booking): ?array
    {
        $pdo = Database::getConnection();
        $pdo->beginTransaction();
        $bookingId = null;

        try {
            $stmt = $pdo->prepare(
                "INSERT INTO bookings
                  (booking_ref, user_id, user_name, passenger_email, flight_number, from_airport, to_airport,
                   travel_date, cabin_class, passengers, total_price, status, seat_selection, passenger_details, itinerary, cancelled_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt->execute([
                $booking['bookingRef'],
                $booking['userId'] ?? null,
                $booking['userName'],
                $booking['passengerEmail'],
                $booking['flightNumber'],
                $booking['from'],
                $booking['to'],
                $booking['date'],
                $booking['cabinClass'],
                $booking['passengers'],
                $booking['totalPrice'],
                $booking['status'] ?? 'confirmed',
                $booking['seat'] ?? null,
                json_encode($booking['passengerDetails'] ?? []),
                json_encode($booking['itinerary'] ?? ['segments' => []]),
                ($booking['status'] ?? '') === 'cancelled' ? date('Y-m-d H:i:s') : null,
            ]);
            $bookingId = (int) $pdo->lastInsertId();

            foreach (($booking['passengerDetails'] ?? []) as $i => $p) {
                $pStmt = $pdo->prepare(
                    "INSERT INTO booking_passengers (booking_id, passenger_index, first_name, last_name, email, phone, nationality, seat_selection)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
                );
                $pStmt->execute([
                    $bookingId, $i,
                    trim((string) ($p['firstName'] ?? '')),
                    trim((string) ($p['lastName'] ?? '')),
                    strtolower(trim((string) ($p['email'] ?? ''))),
                    !empty($p['phone'])       ? trim((string) $p['phone'])       : null,
                    !empty($p['nationality']) ? trim((string) $p['nationality']) : null,
                    $p['seat'] ?? ($i === 0 ? ($booking['seat'] ?? null) : null),
                ]);
            }

            $segments = $booking['itinerary']['segments'] ?? [];
            foreach ($segments as $i => $seg) {
                $sStmt = $pdo->prepare(
                    "INSERT INTO booking_segments
                      (booking_id, segment_index, route_id, flight_number, from_airport, to_airport,
                       departure_date, arrival_date, departure_time, arrival_time,
                       departure_datetime, arrival_datetime, duration_minutes, distance_km,
                       aircraft_id, aircraft_registration, aircraft_type)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                );
                $sStmt->execute([
                    $bookingId, $i,
                    $seg['routeId'] ?? null,
                    $seg['flightNumber'],
                    $seg['from'],
                    $seg['to'],
                    $seg['departureDate'],
                    $seg['arrivalDate'] ?? $seg['departureDate'],
                    $seg['departure'] ?? '',
                    $seg['arrival'] ?? '',
                    self::normalizeDT($seg['departureDateTime'] ?? null, $seg['departureDate']),
                    self::normalizeDT($seg['arrivalDateTime'] ?? null, $seg['arrivalDate'] ?? $seg['departureDate']),
                    $seg['durationMinutes'] ?? 0,
                    $seg['distanceKm'] ?? 0,
                    $seg['aircraft']['id']           ?? null,
                    $seg['aircraft']['registration'] ?? null,
                    $seg['aircraft']['type']         ?? null,
                ]);

                if (!empty($booking['seat'])) {
                    $bsStmt = $pdo->prepare(
                        "INSERT INTO booked_seats (flight_number, departure_date, seat_id, cabin_class, booking_ref) VALUES (?, ?, ?, ?, ?)"
                    );
                    $bsStmt->execute([$seg['flightNumber'], $seg['departureDate'], $booking['seat'], $booking['cabinClass'], $booking['bookingRef']]);
                }
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            if (str_contains($e->getMessage(), 'Duplicate')) {
                $conflict = new \RuntimeException('That seat has just been taken. Please choose another seat.', 409);
                throw $conflict;
            }
            throw $e;
        }

        return self::findByRef($booking['bookingRef']);
    }

    public static function findByRef(string $ref): ?array
    {
        $stmt = Database::getConnection()->prepare("SELECT * FROM bookings WHERE booking_ref = ? LIMIT 1");
        $stmt->execute([$ref]);
        $row  = $stmt->fetch();
        if (!$row) return null;
        $list = self::hydrateBookings([self::mapBooking($row)]);
        return $list[0] ?? null;
    }

    public static function findByRefAndEmail(string $ref, string $email): ?array
    {
        $stmt = Database::getConnection()->prepare(
            "SELECT * FROM bookings WHERE booking_ref = ? AND LOWER(passenger_email) = LOWER(?) LIMIT 1"
        );
        $stmt->execute([$ref, $email]);
        $row  = $stmt->fetch();
        if (!$row) return null;
        $list = self::hydrateBookings([self::mapBooking($row)]);
        return $list[0] ?? null;
    }

    public static function listByUserId(int $userId, ?string $email = null): array
    {
        if ($email) {
            $stmt = Database::getConnection()->prepare(
                "SELECT * FROM bookings WHERE user_id = ? OR LOWER(passenger_email) = LOWER(?) ORDER BY created_at DESC"
            );
            $stmt->execute([$userId, $email]);
        } else {
            $stmt = Database::getConnection()->prepare(
                "SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC"
            );
            $stmt->execute([$userId]);
        }
        return self::hydrateBookings(array_map(fn($r) => self::mapBooking($r), $stmt->fetchAll()));
    }

    public static function listAll(): array
    {
        $rows = Database::getConnection()->query("SELECT * FROM bookings ORDER BY created_at DESC")->fetchAll();
        return self::hydrateBookings(array_map(fn($r) => self::mapBooking($r), $rows));
    }

    public static function updateStatus(string $ref, string $status): ?array
    {
        $pdo = Database::getConnection();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                "UPDATE bookings SET status = ?, cancelled_at = CASE WHEN ? = 'cancelled' THEN NOW() ELSE NULL END WHERE booking_ref = ?"
            );
            $stmt->execute([$status, $status, $ref]);

            if ($status === 'cancelled') {
                $del = $pdo->prepare("DELETE FROM booked_seats WHERE booking_ref = ?");
                $del->execute([$ref]);
            }

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        return self::findByRef($ref);
    }

    public static function getOccupiedSeats(array $segments, string $cabinClass): array
    {
        if (!$segments) return [];

        $conditions = implode(' OR ', array_fill(0, count($segments), '(flight_number = ? AND departure_date = ?)'));
        $values     = [$cabinClass];
        foreach ($segments as $seg) {
            $values[] = $seg['flightNumber'];
            $values[] = $seg['departureDate'];
        }

        $stmt = Database::getConnection()->prepare(
            "SELECT DISTINCT seat_id FROM booked_seats WHERE cabin_class = ? AND ({$conditions})"
        );
        $stmt->execute($values);
        return array_column($stmt->fetchAll(), 'seat_id');
    }

    private static function normalizeDT(?string $value, string $fallbackDate): string
    {
        if ($value) return str_replace(['T', 'Z'], [' ', ''], $value);
        return "{$fallbackDate} 00:00:00";
    }
}

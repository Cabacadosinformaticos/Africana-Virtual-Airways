<?php

declare(strict_types=1);

namespace AFV\Repositories;

class AirlineStatsRepository
{
    private static function mapRow(array $r): array
    {
        return [
            'totalFlights'   => $r['total_flights'],
            'totalHours'     => $r['total_hours'],
            'activeMembers'  => $r['active_members'],
            'foundedDate'    => $r['founded_date'],
            'firstFlight'    => [
                'from' => $r['first_flight_from'],
                'to'   => $r['first_flight_to'],
                'date' => $r['first_flight_date'],
            ],
            'division'       => $r['division'],
            'callsignPrefix' => $r['callsign_prefix'],
            'updatedAt'      => $r['updated_at'],
        ];
    }

    public static function getStats(): ?array
    {
        $row = Database::getConnection()->query("SELECT * FROM airline_stats LIMIT 1")->fetch();
        return $row ? self::mapRow($row) : null;
    }

    public static function updateStats(array $patch): ?array
    {
        $fieldMap = [
            'totalFlights'   => 'total_flights',
            'totalHours'     => 'total_hours',
            'activeMembers'  => 'active_members',
            'foundedDate'    => 'founded_date',
            'division'       => 'division',
            'callsignPrefix' => 'callsign_prefix',
        ];

        $setClauses = [];
        $values     = [];
        foreach ($fieldMap as $key => $col) {
            if (array_key_exists($key, $patch)) {
                $setClauses[] = "{$col} = ?";
                $values[]     = $patch[$key];
            }
        }

        if (!$setClauses) return self::getStats();

        $stmt = Database::getConnection()->prepare(
            "UPDATE airline_stats SET " . implode(', ', $setClauses) . " WHERE id = 1"
        );
        $stmt->execute($values);
        return self::getStats();
    }
}

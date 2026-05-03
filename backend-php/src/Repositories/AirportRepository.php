<?php

declare(strict_types=1);

namespace AFV\Repositories;

class AirportRepository
{
    private static ?array $cache = null;

    public static function getAll(): array
    {
        if (self::$cache !== null) return self::$cache;

        $rows        = Database::getConnection()->query("SELECT * FROM airports ORDER BY icao ASC")->fetchAll();
        self::$cache = [];
        foreach ($rows as $row) {
            self::$cache[$row['icao']] = [
                'icao'    => $row['icao'],
                'iata'    => $row['iata'],
                'name'    => $row['name'],
                'city'    => $row['city'],
                'country' => $row['country'],
                'lat'     => (float) $row['lat'],
                'lon'     => (float) $row['lon'],
                'hub'     => $row['hub'] == 1,
            ];
        }
        return self::$cache;
    }

    public static function getOne(string $icao): ?array
    {
        $airports = self::getAll();
        return $airports[strtoupper($icao)] ?? null;
    }

    public static function invalidateCache(): void
    {
        self::$cache = null;
    }
}

<?php

declare(strict_types=1);

namespace AFV\Helpers;

class DistanceHelper
{
    private const EARTH_RADIUS_KM = 6371;

    public static function haversineDistance(float $lat1, float $lon1, float $lat2, float $lon2): int
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return (int) round(self::EARTH_RADIUS_KM * $c);
    }

    public static function estimateDurationMinutes(int $distanceKm): int
    {
        $blockSpeedKmh = 820;
        $extra = $distanceKm < 1000 ? 45 : 30;
        return (int) round(($distanceKm / $blockSpeedKmh) * 60) + $extra;
    }

    public static function estimateDuration(int $distanceKm): string
    {
        $totalMinutes = self::estimateDurationMinutes($distanceKm);
        $hours   = intdiv($totalMinutes, 60);
        $minutes = $totalMinutes % 60;
        return "{$hours}h " . str_pad((string)$minutes, 2, '0', STR_PAD_LEFT) . 'm';
    }

    public static function routeCategory(int $distanceKm): string
    {
        if ($distanceKm < 1500) return 'Regional';
        if ($distanceKm < 5000) return 'Short Range';
        return 'Long Range';
    }
}

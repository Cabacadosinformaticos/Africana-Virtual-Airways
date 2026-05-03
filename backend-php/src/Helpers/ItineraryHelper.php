<?php

declare(strict_types=1);

namespace AFV\Helpers;

class ItineraryHelper
{
    public static function parseJsonField(mixed $value, mixed $fallback = null): mixed
    {
        if ($value === null) return $fallback;
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            return json_last_error() === JSON_ERROR_NONE ? $decoded : $fallback;
        }
        return $value;
    }

    public static function pad(int|string $value): string
    {
        return str_pad((string) $value, 2, '0', STR_PAD_LEFT);
    }

    public static function formatIsoDate(\DateTime $date): string
    {
        return $date->format('Y-m-d');
    }

    public static function timeStringToMinutes(string $timeString): int
    {
        $parts   = explode(':', $timeString);
        $hours   = (int) ($parts[0] ?? 0);
        $minutes = (int) ($parts[1] ?? 0);
        $seconds = (int) ($parts[2] ?? 0);
        return $hours * 60 + $minutes + intdiv($seconds, 60);
    }

    public static function combineDateAndTime(string $dateString, string $timeString): \DateTime
    {
        $normalizedTime = strlen($timeString) === 5 ? "{$timeString}:00" : $timeString;
        $dt = \DateTime::createFromFormat('Y-m-d H:i:s', "{$dateString} {$normalizedTime}");
        if ($dt === false) {
            throw new \RuntimeException("Invalid date/time: {$dateString} {$normalizedTime}");
        }
        return $dt;
    }

    public static function addMinutes(\DateTime $date, int $minutes): \DateTime
    {
        $result = clone $date;
        $result->modify("{$minutes} minutes");
        return $result;
    }

    public static function formatDurationMinutes(float $totalMinutes): string
    {
        $safe    = max(0, (int) round($totalMinutes));
        $hours   = intdiv($safe, 60);
        $minutes = $safe % 60;
        return "{$hours}h " . self::pad($minutes) . 'm';
    }

    public static function startOfDay(\DateTime $date): \DateTime
    {
        $result = clone $date;
        $result->setTime(0, 0, 0, 0);
        return $result;
    }

    public static function dayOffset(\DateTime $fromDate, \DateTime $toDate): int
    {
        $from = self::startOfDay($fromDate)->getTimestamp();
        $to   = self::startOfDay($toDate)->getTimestamp();
        return (int) round(($to - $from) / 86400);
    }

    public static function formatDisplayTime(\DateTime $date, ?\DateTime $referenceDate = null): string
    {
        $value = $date->format('H:i');
        if ($referenceDate === null) return $value;
        $offset = self::dayOffset($referenceDate, $date);
        return $offset > 0 ? "{$value}+{$offset}" : $value;
    }

    public static function buildSegmentKey(string $flightNumber, string $departureDate): string
    {
        return "{$flightNumber}|{$departureDate}";
    }
}

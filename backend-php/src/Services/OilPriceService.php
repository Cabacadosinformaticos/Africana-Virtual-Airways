<?php

declare(strict_types=1);

namespace AFV\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

class OilPriceService
{
    private const OIL_BASELINE = 80.0;
    private const CACHE_TTL    = 86400; // 24 h in seconds

    private static bool  $initialized      = false;
    private static float $cachedPrice      = self::OIL_BASELINE;
    private static float $cachedMultiplier = 1.0;
    private static int   $lastFetchAt      = 0;
    private static string $source          = 'fallback';

    private static function cacheFile(): string
    {
        return sys_get_temp_dir() . '/afv_oil_cache.json';
    }

    private static function init(): void
    {
        if (self::$initialized) return;
        self::$initialized = true;

        $file = self::cacheFile();
        if (file_exists($file)) {
            $data = json_decode((string) file_get_contents($file), true);
            if (is_array($data)) {
                self::$cachedPrice      = (float) ($data['price']      ?? self::OIL_BASELINE);
                self::$cachedMultiplier = (float) ($data['multiplier'] ?? 1.0);
                self::$lastFetchAt      = (int)   ($data['fetchedAt']  ?? 0);
                self::$source           = (string) ($data['source']    ?? 'fallback');
            }
        }
    }

    public static function refreshOilPrice(): void
    {
        $apiKey = getenv('ALPHA_VANTAGE_KEY') ?: '';
        if (!$apiKey) {
            error_log('[Oil] No ALPHA_VANTAGE_KEY set — using baseline $80/barrel');
            return;
        }

        try {
            $client = new Client(['timeout' => 8, 'verify' => false]);
            $url    = 'https://www.alphavantage.co/query?function=BRENT&interval=monthly&apikey=' . urlencode($apiKey);
            $res    = $client->get($url);
            $json   = json_decode((string) $res->getBody(), true);

            $entries = $json['data'] ?? null;
            if (!is_array($entries) || empty($entries)) {
                throw new \RuntimeException('Empty data');
            }

            $latest = (float) $entries[0]['value'];
            if ($latest <= 0) throw new \RuntimeException('Invalid price');

            $raw = $latest / self::OIL_BASELINE;
            self::$cachedPrice      = $latest;
            self::$cachedMultiplier = max(0.70, min(1.50, 0.70 + 0.30 * $raw));
            self::$lastFetchAt      = time();
            self::$source           = 'live';
            self::$initialized      = true;

            file_put_contents(self::cacheFile(), json_encode([
                'price'      => self::$cachedPrice,
                'multiplier' => self::$cachedMultiplier,
                'fetchedAt'  => self::$lastFetchAt,
                'source'     => self::$source,
            ]));

            error_log(sprintf('[Oil] Brent crude: $%.2f/bbl → fare multiplier %.3f×', $latest, self::$cachedMultiplier));
        } catch (\Throwable $e) {
            error_log('[Oil] Price fetch failed (' . $e->getMessage() . ') — retaining $' . number_format(self::$cachedPrice, 2) . '/bbl');
        }
    }

    public static function getFuelMultiplier(): float
    {
        self::init();
        if (time() - self::$lastFetchAt > self::CACHE_TTL) {
            self::refreshOilPrice();
        }
        return self::$cachedMultiplier;
    }

    public static function getOilContext(): array
    {
        self::init();
        return [
            'priceUSD'   => self::$cachedPrice,
            'baseline'   => self::OIL_BASELINE,
            'multiplier' => self::$cachedMultiplier,
            'source'     => self::$source,
            'cachedAt'   => self::$lastFetchAt > 0 ? date('c', self::$lastFetchAt) : null,
        ];
    }
}

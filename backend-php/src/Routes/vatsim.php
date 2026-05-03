<?php

declare(strict_types=1);

use AFV\Helpers\DistanceHelper;
use AFV\Repositories\AirlineStatsRepository;
use AFV\Repositories\AirportRepository;
use GuzzleHttp\Client;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;

return function (App $app): void {

    $app->get('/api/vatsim/online', function (Request $request, Response $response): Response {
        $live = fetchLivePilots();
        if ($live) {
            return json_ok($response, [
                'source'       => 'live',
                'onlinePilots' => $live['pilots'],
                'count'        => count($live['pilots']),
                'updatedAt'    => $live['updatedAt'],
            ]);
        }
        return json_ok($response, [
            'source'       => 'live',
            'onlinePilots' => [],
            'count'        => 0,
            'updatedAt'    => (new \DateTime())->format('c'),
        ]);
    });

    $app->get('/api/vatsim/stats', function (Request $request, Response $response): Response {
        $stats = AirlineStatsRepository::getStats();
        if (!$stats) return json_error($response, 'Airline stats not found', 404);
        return json_ok($response, $stats);
    });

};

// ── Caches ─────────────────────────────────────────────────────────────────

function vatsimCacheFile(): string { return sys_get_temp_dir() . '/afv_vatsim_cache.json'; }
function metarCacheFile(string $icao): string { return sys_get_temp_dir() . '/afv_metar_' . preg_replace('/[^A-Z0-9]/i', '', $icao) . '.json'; }

function fetchLivePilots(): ?array
{
    $cacheFile = vatsimCacheFile();
    if (file_exists($cacheFile)) {
        $data = json_decode((string) file_get_contents($cacheFile), true);
        if ($data && (time() - ($data['fetchedAt'] ?? 0)) < 60) {
            return $data;
        }
    }

    try {
        $caBundle = dirname(__DIR__, 2) . '/cacert.pem';
        $client   = new Client([
            'timeout' => 10,
            'verify'  => file_exists($caBundle) ? $caBundle : true,
            'headers' => ['User-Agent' => 'AfricanaVirtualAirways/1.0 VATSIM-tracker'],
        ]);
        $airports = AirportRepository::getAll();

        $res  = $client->get('https://data.vatsim.net/v3/vatsim-data.json');
        $data = json_decode((string) $res->getBody(), true);

        $pilots = [];
        foreach ($data['pilots'] ?? [] as $p) {
            if (!isset($p['callsign']) || !str_starts_with(strtoupper($p['callsign']), 'AFV')) continue;

            $from = $p['flight_plan']['departure']      ?? '????';
            $to   = $p['flight_plan']['arrival']        ?? '????';
            $pilot = [
                'callsign'    => $p['callsign'],
                'name'        => $p['name'],
                'cid'         => (string) $p['cid'],
                'from'        => $from,
                'to'          => $to,
                'aircraft'    => $p['flight_plan']['aircraft_short'] ?? $p['flight_plan']['aircraft'] ?? '????',
                'altitude'    => $p['altitude'],
                'groundspeed' => $p['groundspeed'],
                'lat'         => $p['latitude'],
                'lon'         => $p['longitude'],
                'heading'     => $p['heading'],
                'logonTime'   => $p['logon_time'],
                'fromCoords'  => isset($airports[$from]) ? [$airports[$from]['lat'], $airports[$from]['lon']] : null,
                'toCoords'    => isset($airports[$to])   ? [$airports[$to]['lat'],   $airports[$to]['lon']]   : null,
            ];
            $pilot['timing'] = computePilotTiming($pilot, $airports, $p['flight_plan']['deptime'] ?? null, $p['flight_plan']['enroute_time'] ?? null);
            $pilots[] = $pilot;
        }

        // Fetch destination METARs
        $uniqueDests = array_unique(array_filter(array_column($pilots, 'to')));
        $metarMap    = [];
        foreach ($uniqueDests as $icao) {
            $metarMap[$icao] = fetchMetar((string) $icao);
        }
        foreach ($pilots as &$pilot) {
            $pilot['destinationWeather'] = $metarMap[$pilot['to']] ?? null;
        }
        unset($pilot);

        $result = ['source' => 'live', 'pilots' => $pilots, 'updatedAt' => (new \DateTime())->format('c'), 'fetchedAt' => time()];
        file_put_contents($cacheFile, json_encode($result));
        return $result;

    } catch (\Throwable $e) {
        return null;
    }
}

function fetchMetar(string $icao): ?array
{
    $cacheFile = metarCacheFile($icao);
    if (file_exists($cacheFile)) {
        $data = json_decode((string) file_get_contents($cacheFile), true);
        if ($data && (time() - ($data['fetchedAt'] ?? 0)) < 600) {
            return $data['weather'] ?? null;
        }
    }

    try {
        $caBundle = dirname(__DIR__, 2) . '/cacert.pem';
        $client = new Client([
            'timeout' => 5,
            'verify'  => file_exists($caBundle) ? $caBundle : true,
            'headers' => ['User-Agent' => 'AfricanaVirtualAirways/1.0 METAR-fetcher'],
        ]);
        $url = "https://aviationweather.gov/api/data/metar?ids={$icao}&format=json&hours=2";
        $res    = $client->get($url);
        $data   = json_decode((string) $res->getBody(), true);

        $weather = (is_array($data) && $data) ? parseMetar($data[0]) : null;
        file_put_contents($cacheFile, json_encode(['weather' => $weather, 'fetchedAt' => time()]));
        return $weather;

    } catch (\Throwable $e) {
        return null;
    }
}

function parseMetar(array $raw): ?array
{
    $temp = isset($raw['temp']) ? (int) round((float) $raw['temp']) : null;

    if (empty($raw['wspd']) || (int) $raw['wspd'] === 0) {
        $windText = 'Calm';
    } else {
        $dir   = degToCompass($raw['wdir'] ?? null);
        $gust  = !empty($raw['wgst']) ? " gusting {$raw['wgst']}" : '';
        $windText = "{$raw['wspd']}{$gust} kt {$dir}";
    }

    $conditions = wxToText($raw['wxString'] ?? null) ?? cloudDescription($raw);
    $visNum     = isset($raw['visib']) ? (float) $raw['visib'] : null;
    $visPoor    = $visNum !== null && $visNum < 3;
    $visText    = $visPoor ? "{$visNum} SM vis" : null;

    return ['temp' => $temp, 'wind' => $windText, 'conditions' => $conditions, 'visText' => $visText];
}

function degToCompass(mixed $deg): string
{
    if (!$deg || $deg === 'VRB') return 'Variable';
    $dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return $dirs[(int) round((float) $deg / 22.5) % 16];
}

function wxToText(?string $wx): ?string
{
    if (!$wx) return null;
    if (str_contains($wx, 'TS'))  return 'Thunderstorm';
    if (str_contains($wx, '+RA')) return 'Heavy rain';
    if (str_contains($wx, '-RA')) return 'Light rain';
    if (str_contains($wx, 'RA'))  return 'Rain';
    if (str_contains($wx, '+SN')) return 'Heavy snow';
    if (str_contains($wx, '-SN')) return 'Light snow';
    if (str_contains($wx, 'SN'))  return 'Snow';
    if (str_contains($wx, 'FG'))  return 'Fog';
    if (str_contains($wx, 'BR'))  return 'Mist';
    if (str_contains($wx, 'HZ'))  return 'Haze';
    if (str_contains($wx, '-DZ')) return 'Light drizzle';
    if (str_contains($wx, 'DZ'))  return 'Drizzle';
    if (str_contains($wx, 'SH'))  return 'Showers';
    return null;
}

function cloudDescription(array $m): string
{
    $layers = [];
    for ($i = 1; $i <= 4; $i++) {
        if (!empty($m["cldCvg{$i}"])) $layers[] = ['cover' => $m["cldCvg{$i}"], 'base' => $m["cldBas{$i}"] ?? null];
    }

    $sig = array_filter($layers, fn($l) => in_array($l['cover'], ['OVC','BKN'], true));
    if (!$sig) {
        $sct = array_filter($layers, fn($l) => $l['cover'] === 'SCT');
        if ($sct) return 'Partly cloudy';
        return $layers ? 'Few clouds' : 'Clear skies';
    }
    return reset($sig)['cover'] === 'OVC' ? 'Overcast' : 'Mostly cloudy';
}

function parseHHMM(?string $hhmm): ?int
{
    if (!$hhmm || strlen($hhmm) < 4 || $hhmm === '0000') return null;
    $h = (int) substr($hhmm, 0, 2);
    $m = (int) substr($hhmm, 2, 2);
    return ($h * 60 + $m);
}

function computePilotTiming(array $pilot, array $airports, ?string $deptime, ?string $enroute): ?array
{
    $depMin = parseHHMM($deptime);
    $enrMin = parseHHMM($enroute);
    if ($depMin === null || $enrMin === null) return null;

    $now      = time();
    $logonMs  = $pilot['logonTime'] ? strtotime($pilot['logonTime']) : $now;

    // Anchor departure to logon day in UTC
    $base     = (int) strtotime(gmdate('Y-m-d', $logonMs) . ' 00:00:00 UTC');
    $scheduledDep = $base + $depMin * 60;
    if ($scheduledDep > $logonMs + 6 * 3600) $scheduledDep -= 86400;
    $scheduledArr = $scheduledDep + $enrMin * 60;

    $rawDepDelay  = (int) round(($logonMs - $scheduledDep) / 60);
    $depDelayMin  = abs($rawDepDelay) < 720 ? $rawDepDelay : null;

    $eta = $arrDelayMin = $distRemKm = $distTotalKm = $progress = null;
    $dest = $airports[$pilot['to']] ?? null;

    if ($dest && (int) $pilot['groundspeed'] > 50) {
        $distRemKm = DistanceHelper::haversineDistance($pilot['lat'], $pilot['lon'], $dest['lat'], $dest['lon']);
        $gsKmh     = $pilot['groundspeed'] * 1.852;
        $eta       = $now + (int) round(($distRemKm / $gsKmh) * 3600);
        $arrDelayMin = (int) round(($eta - $scheduledArr) / 60);

        $orig = $airports[$pilot['from']] ?? null;
        if ($orig) {
            $distTotalKm = DistanceHelper::haversineDistance($orig['lat'], $orig['lon'], $dest['lat'], $dest['lon']);
            $progress    = max(0, min(100, (int) round((1 - $distRemKm / $distTotalKm) * 100)));
        }
    }

    $fmtTime = fn(int $ts) => gmdate('H:i', $ts);

    return [
        'scheduledDep'       => gmdate('c', $scheduledDep),
        'scheduledArr'       => gmdate('c', $scheduledArr),
        'scheduledDepStr'    => $fmtTime($scheduledDep),
        'scheduledArrStr'    => $fmtTime($scheduledArr),
        'eta'                => $eta ? gmdate('c', $eta) : null,
        'etaStr'             => $eta ? $fmtTime($eta) : null,
        'depDelayMin'        => $depDelayMin,
        'arrDelayMin'        => $arrDelayMin,
        'distanceRemainingKm'=> $distRemKm,
        'distanceTotalKm'    => $distTotalKm,
        'progress'           => $progress,
    ];
}

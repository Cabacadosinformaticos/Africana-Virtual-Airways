<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

cors_headers();
$method = $_SERVER['REQUEST_METHOD'];
$path   = api_path('/api/vatsim');

// GET /api/vatsim/stats
if ($method === 'GET' && $path === 'stats') {
    $row = db()->query("SELECT * FROM airline_stats LIMIT 1")->fetch();
    if (!$row) json_err('Airline stats not found', 404);
    json_ok(['totalFlights'=>$row['total_flights'],'totalHours'=>$row['total_hours'],'activeMembers'=>$row['active_members'],
        'foundedDate'=>$row['founded_date'],'firstFlight'=>['from'=>$row['first_flight_from'],'to'=>$row['first_flight_to'],'date'=>$row['first_flight_date']],
        'division'=>$row['division'],'callsignPrefix'=>$row['callsign_prefix'],'updatedAt'=>$row['updated_at']]);
}

// GET /api/vatsim/online
if ($method === 'GET' && $path === 'online') {
    $data = _vatsim_fetch_pilots();
    if ($data) {
        json_ok(['source'=>'live','onlinePilots'=>$data['pilots'],'count'=>count($data['pilots']),'updatedAt'=>$data['updatedAt']]);
    }
    json_ok(['source'=>'live','onlinePilots'=>[],'count'=>0,'updatedAt'=>(new DateTime())->format('c')]);
}

json_err('Not found', 404);

// ── VATSIM helpers ────────────────────────────────────────────────────────────

function _vatsim_cache(): string { return sys_get_temp_dir() . '/afv_vatsim_cache.json'; }
function _metar_cache(string $icao): string { return sys_get_temp_dir() . '/afv_metar_' . preg_replace('/[^A-Z0-9]/i','', $icao) . '.json'; }

function _vatsim_fetch_pilots(): ?array {
    $file = _vatsim_cache();
    if (file_exists($file)) {
        $d = json_decode((string)file_get_contents($file), true);
        if ($d && (time() - (int)($d['fetchedAt']??0)) < 60) return $d;
    }
    try {
        $ctx     = stream_context_create(['http'=>['timeout'=>10,'user_agent'=>'AfricanaVirtualAirways/1.0 VATSIM-tracker']]);
        $airports = get_airports();
        $raw     = @file_get_contents('https://data.vatsim.net/v3/vatsim-data.json', false, $ctx);
        if (!$raw) return null;
        $data    = json_decode($raw, true);

        $pilots = [];
        foreach ($data['pilots'] ?? [] as $p) {
            if (!isset($p['callsign']) || !str_starts_with(strtoupper($p['callsign']),'AFV')) continue;
            $from = $p['flight_plan']['departure'] ?? '????';
            $to   = $p['flight_plan']['arrival']   ?? '????';
            $pilot = ['callsign'=>$p['callsign'],'name'=>$p['name'],'cid'=>(string)$p['cid'],
                'from'=>$from,'to'=>$to,'aircraft'=>$p['flight_plan']['aircraft_short']??$p['flight_plan']['aircraft']??'????',
                'altitude'=>$p['altitude'],'groundspeed'=>$p['groundspeed'],'lat'=>$p['latitude'],'lon'=>$p['longitude'],
                'heading'=>$p['heading'],'logonTime'=>$p['logon_time'],
                'fromCoords'=>isset($airports[$from])?[$airports[$from]['lat'],$airports[$from]['lon']]:null,
                'toCoords'  =>isset($airports[$to])  ?[$airports[$to]['lat'],  $airports[$to]['lon']]:null];
            $pilot['timing'] = _vatsim_timing($pilot, $airports, $p['flight_plan']['deptime']??null, $p['flight_plan']['enroute_time']??null);
            $pilots[] = $pilot;
        }

        $dests = array_unique(array_filter(array_column($pilots,'to')));
        $metars = [];
        foreach ($dests as $icao) { $metars[$icao] = _metar_fetch((string)$icao); }
        foreach ($pilots as &$pilot) { $pilot['destinationWeather'] = $metars[$pilot['to']]??null; }
        unset($pilot);

        $result = ['source'=>'live','pilots'=>$pilots,'updatedAt'=>(new DateTime())->format('c'),'fetchedAt'=>time()];
        file_put_contents($file, json_encode($result));
        return $result;
    } catch (Throwable) { return null; }
}

function _metar_fetch(string $icao): ?array {
    $file = _metar_cache($icao);
    if (file_exists($file)) {
        $d = json_decode((string)file_get_contents($file), true);
        if ($d && (time()-(int)($d['fetchedAt']??0)) < 600) return $d['weather']??null;
    }
    try {
        $ctx = stream_context_create(['http'=>['timeout'=>5,'user_agent'=>'AfricanaVirtualAirways/1.0 METAR-fetcher']]);
        $raw = @file_get_contents("https://aviationweather.gov/api/data/metar?ids={$icao}&format=json&hours=2", false, $ctx);
        if (!$raw) return null;
        $data    = json_decode($raw, true);
        $weather = (is_array($data) && $data) ? _metar_parse($data[0]) : null;
        file_put_contents($file, json_encode(['weather'=>$weather,'fetchedAt'=>time()]));
        return $weather;
    } catch (Throwable) { return null; }
}

function _metar_parse(array $raw): ?array {
    $temp = isset($raw['temp']) ? (int)round((float)$raw['temp']) : null;
    if (empty($raw['wspd']) || (int)$raw['wspd']===0) { $wind = 'Calm'; }
    else {
        $dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
        $dir  = (!$raw['wdir']||$raw['wdir']==='VRB') ? 'Variable' : $dirs[(int)round((float)$raw['wdir']/22.5)%16];
        $gust = !empty($raw['wgst']) ? " gusting {$raw['wgst']}" : '';
        $wind = "{$raw['wspd']}{$gust} kt {$dir}";
    }
    $wx = $raw['wxString'] ?? null;
    $conditions = _wx_to_text($wx) ?? _cloud_desc($raw);
    $vis    = isset($raw['visib']) ? (float)$raw['visib'] : null;
    $visText = ($vis !== null && $vis < 3) ? "{$vis} SM vis" : null;
    return ['temp'=>$temp,'wind'=>$wind,'conditions'=>$conditions,'visText'=>$visText];
}

function _wx_to_text(?string $wx): ?string {
    if (!$wx) return null;
    if (str_contains($wx,'TS'))  return 'Thunderstorm';
    if (str_contains($wx,'+RA')) return 'Heavy rain';
    if (str_contains($wx,'-RA')) return 'Light rain';
    if (str_contains($wx,'RA'))  return 'Rain';
    if (str_contains($wx,'+SN')) return 'Heavy snow';
    if (str_contains($wx,'-SN')) return 'Light snow';
    if (str_contains($wx,'SN'))  return 'Snow';
    if (str_contains($wx,'FG'))  return 'Fog';
    if (str_contains($wx,'BR'))  return 'Mist';
    if (str_contains($wx,'HZ'))  return 'Haze';
    if (str_contains($wx,'-DZ')) return 'Light drizzle';
    if (str_contains($wx,'DZ'))  return 'Drizzle';
    if (str_contains($wx,'SH'))  return 'Showers';
    return null;
}

function _cloud_desc(array $m): string {
    $layers = [];
    for ($i=1;$i<=4;$i++) { if (!empty($m["cldCvg{$i}"])) $layers[]=['cover'=>$m["cldCvg{$i}"],'base'=>$m["cldBas{$i}"]??null]; }
    $sig = array_filter($layers, fn($l)=>in_array($l['cover'],['OVC','BKN'],true));
    if (!$sig) { $sct=array_filter($layers,fn($l)=>$l['cover']==='SCT'); return $sct?'Partly cloudy':($layers?'Few clouds':'Clear skies'); }
    return reset($sig)['cover']==='OVC'?'Overcast':'Mostly cloudy';
}

function _vatsim_timing(array $pilot, array $airports, ?string $deptime, ?string $enroute): ?array {
    $dep = _parse_hhmm($deptime); $enr = _parse_hhmm($enroute);
    if ($dep===null||$enr===null) return null;

    $now     = time();
    $logon   = $pilot['logonTime'] ? strtotime($pilot['logonTime']) : $now;
    $base    = (int)strtotime(gmdate('Y-m-d',$logon).' 00:00:00 UTC');
    $schedDep = $base + $dep*60;
    if ($schedDep > $logon + 6*3600) $schedDep -= 86400;
    $schedArr = $schedDep + $enr*60;
    $rawDelay = (int)round(($logon - $schedDep)/60);
    $depDelay = abs($rawDelay)<720?$rawDelay:null;

    $eta=$arrDelay=$distRem=$distTotal=$progress=null;
    $dest = $airports[$pilot['to']] ?? null;
    if ($dest && (int)$pilot['groundspeed']>50) {
        $distRem   = haversine($pilot['lat'],$pilot['lon'],$dest['lat'],$dest['lon']);
        $gsKmh     = $pilot['groundspeed']*1.852;
        $eta       = $now+(int)round(($distRem/$gsKmh)*3600);
        $arrDelay  = (int)round(($eta-$schedArr)/60);
        $orig = $airports[$pilot['from']] ?? null;
        if ($orig) {
            $distTotal = haversine($orig['lat'],$orig['lon'],$dest['lat'],$dest['lon']);
            $progress  = max(0,min(100,(int)round((1-$distRem/$distTotal)*100)));
        }
    }
    return ['scheduledDep'=>gmdate('c',$schedDep),'scheduledArr'=>gmdate('c',$schedArr),
        'scheduledDepStr'=>gmdate('H:i',$schedDep),'scheduledArrStr'=>gmdate('H:i',$schedArr),
        'eta'=>$eta?gmdate('c',$eta):null,'etaStr'=>$eta?gmdate('H:i',$eta):null,
        'depDelayMin'=>$depDelay,'arrDelayMin'=>$arrDelay,
        'distanceRemainingKm'=>$distRem,'distanceTotalKm'=>$distTotal,'progress'=>$progress];
}

function _parse_hhmm(?string $hhmm): ?int {
    if (!$hhmm||strlen($hhmm)<4||$hhmm==='0000') return null;
    return (int)substr($hhmm,0,2)*60 + (int)substr($hhmm,2,2);
}

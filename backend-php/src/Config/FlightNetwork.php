<?php

declare(strict_types=1);

namespace AFV\Config;

class FlightNetwork
{
    public static function getRoutes(): array
    {
        return [
            // ── Maputo hub (FQMA) — domestic Mozambique ──────────────────────
            ['flightNumber' => 'AFV100', 'from' => 'FQMA', 'to' => 'FQNC', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV101', 'from' => 'FQNC', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV102', 'from' => 'FQMA', 'to' => 'FQBR', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV103', 'from' => 'FQBR', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV104', 'from' => 'FQMA', 'to' => 'FQVL', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV105', 'from' => 'FQVL', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV106', 'from' => 'FQMA', 'to' => 'FQTT', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV107', 'from' => 'FQTT', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV108', 'from' => 'FQMA', 'to' => 'FQQL', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV109', 'from' => 'FQQL', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV110', 'from' => 'FQMA', 'to' => 'FQCH', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV211', 'from' => 'FQCH', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV112', 'from' => 'FQMA', 'to' => 'FQNP', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV113', 'from' => 'FQNP', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV114', 'from' => 'FQMA', 'to' => 'FQIN', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV115', 'from' => 'FQIN', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV116', 'from' => 'FQMA', 'to' => 'FQLC', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV117', 'from' => 'FQLC', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV118', 'from' => 'FQMA', 'to' => 'FQPB', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV119', 'from' => 'FQPB', 'to' => 'FQMA', 'hub' => 'FQMA'],
            // ── Maputo hub (FQMA) — regional (FQNC spokes) ──────────────────
            ['flightNumber' => 'AFV120', 'from' => 'FQNC', 'to' => 'FQBR', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV121', 'from' => 'FQBR', 'to' => 'FQNC', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV122', 'from' => 'FQNC', 'to' => 'FQVL', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV123', 'from' => 'FQVL', 'to' => 'FQNC', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV124', 'from' => 'FQNC', 'to' => 'FQTT', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV125', 'from' => 'FQTT', 'to' => 'FQNC', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV128', 'from' => 'FQNC', 'to' => 'FQCH', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV129', 'from' => 'FQCH', 'to' => 'FQNC', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV130', 'from' => 'FQNC', 'to' => 'FQIN', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV131', 'from' => 'FQIN', 'to' => 'FQNC', 'hub' => 'FQMA'],
            // ── Maputo hub (FQMA) — Southern Africa ─────────────────────────
            ['flightNumber' => 'AFV201', 'from' => 'FQMA', 'to' => 'FAOR', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV202', 'from' => 'FAOR', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV203', 'from' => 'FAOR', 'to' => 'FQNC', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV204', 'from' => 'FQNC', 'to' => 'FAOR', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV205', 'from' => 'FQMA', 'to' => 'FACT', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV206', 'from' => 'FACT', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV207', 'from' => 'FQNC', 'to' => 'FACT', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV208', 'from' => 'FACT', 'to' => 'FQNC', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV209', 'from' => 'FQMA', 'to' => 'FALE', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV210', 'from' => 'FALE', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV221', 'from' => 'FQMA', 'to' => 'HKJK', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV222', 'from' => 'HKJK', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV223', 'from' => 'FQNC', 'to' => 'HKJK', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV224', 'from' => 'HKJK', 'to' => 'FQNC', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV233', 'from' => 'FQMA', 'to' => 'FYWH', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV234', 'from' => 'FYWH', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV235', 'from' => 'FQMA', 'to' => 'FVRG', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV236', 'from' => 'FVRG', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV237', 'from' => 'FQMA', 'to' => 'FZAA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV238', 'from' => 'FZAA', 'to' => 'FQMA', 'hub' => 'FQMA'],
            // ── Inter-hub ────────────────────────────────────────────────────
            ['flightNumber' => 'AFV261', 'from' => 'FQMA', 'to' => 'DAAG', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV262', 'from' => 'DAAG', 'to' => 'FQMA', 'hub' => 'DAAG'],
            // ── Maputo hub (FQMA) — Middle East ─────────────────────────────
            ['flightNumber' => 'AFV403', 'from' => 'FQMA', 'to' => 'OMDB', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV404', 'from' => 'OMDB', 'to' => 'FQMA', 'hub' => 'FQMA'],
            // ── Maputo hub (FQMA) — Europe ───────────────────────────────────
            ['flightNumber' => 'AFV371', 'from' => 'FQMA', 'to' => 'EGLL', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV372', 'from' => 'EGLL', 'to' => 'FQMA', 'hub' => 'FQMA'],
            // ── Maputo hub (FQMA) — Americas ─────────────────────────────────
            ['flightNumber' => 'AFV304', 'from' => 'SBGR', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV305', 'from' => 'FQMA', 'to' => 'SBGR', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV345', 'from' => 'FQMA', 'to' => 'KDFW', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV346', 'from' => 'KDFW', 'to' => 'FQMA', 'hub' => 'FQMA'],
            // ── Maputo hub (FQMA) — Asia ─────────────────────────────────────
            ['flightNumber' => 'AFV407', 'from' => 'FQMA', 'to' => 'WSSS', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV408', 'from' => 'WSSS', 'to' => 'FQMA', 'hub' => 'FQMA'],
            // ── Maputo hub (FQMA) — Oceania ──────────────────────────────────
            ['flightNumber' => 'AFV461', 'from' => 'FQMA', 'to' => 'YSSY', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV462', 'from' => 'YSSY', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV465', 'from' => 'FQMA', 'to' => 'YMML', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV464', 'from' => 'YMML', 'to' => 'FQMA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV467', 'from' => 'FQMA', 'to' => 'NZAA', 'hub' => 'FQMA'],
            ['flightNumber' => 'AFV466', 'from' => 'NZAA', 'to' => 'FQMA', 'hub' => 'FQMA'],
            // ── Algiers hub (DAAG) — North Africa ────────────────────────────
            ['flightNumber' => 'AFV1100', 'from' => 'DAAG', 'to' => 'DAAT', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1101', 'from' => 'DAAT', 'to' => 'DAAG', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1201', 'from' => 'DAAG', 'to' => 'GMMN', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1202', 'from' => 'GMMN', 'to' => 'DAAG', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1205', 'from' => 'DAAG', 'to' => 'DTTA', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1206', 'from' => 'DTTA', 'to' => 'DAAG', 'hub' => 'DAAG'],
            // ── Algiers hub (DAAG) — Americas ────────────────────────────────
            ['flightNumber' => 'AFV1345', 'from' => 'DAAG', 'to' => 'KBOS', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1346', 'from' => 'KBOS', 'to' => 'DAAG', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1347', 'from' => 'DAAG', 'to' => 'KORD', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1348', 'from' => 'KORD', 'to' => 'DAAG', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1349', 'from' => 'DAAG', 'to' => 'KMIA', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1350', 'from' => 'KMIA', 'to' => 'DAAG', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1351', 'from' => 'DAAG', 'to' => 'CYYZ', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1352', 'from' => 'CYYZ', 'to' => 'DAAG', 'hub' => 'DAAG'],
            // ── Algiers hub (DAAG) — Europe ──────────────────────────────────
            ['flightNumber' => 'AFV1361', 'from' => 'DAAG', 'to' => 'LPPT', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1362', 'from' => 'LPPT', 'to' => 'DAAG', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1363', 'from' => 'DAAG', 'to' => 'LFPG', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1364', 'from' => 'LFPG', 'to' => 'DAAG', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1365', 'from' => 'DAAG', 'to' => 'EDDF', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1366', 'from' => 'EDDF', 'to' => 'DAAG', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1371', 'from' => 'DAAG', 'to' => 'EGLL', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1372', 'from' => 'EGLL', 'to' => 'DAAG', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1375', 'from' => 'DAAG', 'to' => 'LEMD', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1376', 'from' => 'LEMD', 'to' => 'DAAG', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1377', 'from' => 'DAAG', 'to' => 'LIML', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1378', 'from' => 'LIML', 'to' => 'DAAG', 'hub' => 'DAAG'],
            // ── Algiers hub (DAAG) — Middle East ─────────────────────────────
            ['flightNumber' => 'AFV1403', 'from' => 'DAAG', 'to' => 'OMDB', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1404', 'from' => 'OMDB', 'to' => 'DAAG', 'hub' => 'DAAG'],
            // ── Algiers hub (DAAG) — Asia-Pacific ────────────────────────────
            ['flightNumber' => 'AFV1409', 'from' => 'DAAG', 'to' => 'RJTT', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1410', 'from' => 'RJTT', 'to' => 'DAAG', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1411', 'from' => 'DAAG', 'to' => 'VHHH', 'hub' => 'DAAG'],
            ['flightNumber' => 'AFV1412', 'from' => 'VHHH', 'to' => 'DAAG', 'hub' => 'DAAG'],
        ];
    }

    public static function getDailySchedules(): array
    {
        return [
            ['slotCode' => 'morning', 'departureTime' => '07:00:00'],
            ['slotCode' => 'midday',  'departureTime' => '12:00:00'],
            ['slotCode' => 'evening', 'departureTime' => '18:00:00'],
        ];
    }

    public static function getAirlineStats(): array
    {
        return [
            'totalFlights'    => 4287,
            'totalHours'      => 12950,
            'activeMembers'   => 63,
            'foundedDate'     => '2020-03-01',
            'firstFlightFrom' => 'FQMA',
            'firstFlightTo'   => 'FQNC',
            'firstFlightDate' => '2020-03-01',
            'division'        => 'VATSIM Sub-Saharan Africa (VATSSA)',
            'callsignPrefix'  => 'AFV',
        ];
    }
}

<?php

declare(strict_types=1);

namespace AFV\Helpers;

use AFV\Services\OilPriceService;

class PricingHelper
{
    private const CLASS_MULTIPLIERS = [
        'economy'  => 1.0,
        'business' => 3.2,
        'first'    => 6.5,
    ];

    private const DEMAND_TIERS = [
        ['threshold' => 0.90, 'multiplier' => 1.45],
        ['threshold' => 0.75, 'multiplier' => 1.20],
        ['threshold' => 0.50, 'multiplier' => 1.00],
        ['threshold' => 0.25, 'multiplier' => 0.85],
        ['threshold' => 0.00, 'multiplier' => 0.70],
    ];

    private static array $AFRICA_PREFIXES = [
        'FA','FB','FC','FD','FE','FG','FH','FI','FJ','FK','FL','FM',
        'FN','FO','FP','FQ','FS','FT','FV','FW','FX','FY','FZ',
        'DA','DB','DC','DD','DF','DG','DI','DN','DR','DT','DX',
        'GM','GQ','GS','GU','GV',
        'HA','HB','HC','HD','HE','HH','HK','HL','HR','HS','HT','HU',
    ];

    private static array $EUROPE_PREFIXES = [
        'ED','EF','EG','EH','EI','EK','EL','EN','EP','ES','ET','EV','EY',
        'LB','LC','LD','LE','LF','LG','LH','LI','LJ','LK','LL','LM',
        'LN','LO','LP','LQ','LR','LS','LT','LU','LV','LW','LX','LY','LZ',
        'UB','UD','UE','UG','UK','UM','UT','UU','UW',
    ];

    private static array $ASIAPAC_PREFIXES = [
        'VH','YM','YB','RJ','RK','WS','WI','VT','VD','VL','VN',
        'ZS','ZB','ZG','ZH','ZL','ZP','ZU','ZW','ZY',
        'PH','PK','PL','PM','PP','PT','PW',
    ];

    public static function getRegion(?string $icao): string
    {
        if (!$icao) return 'other';
        $p2 = strtoupper(substr($icao, 0, 2));
        $p1 = strtoupper(substr($icao, 0, 1));

        if (in_array($p2, self::$AFRICA_PREFIXES, true))  return 'africa';
        if (in_array($p2, self::$EUROPE_PREFIXES, true))  return 'europe';
        if ($p1 === 'O')                                   return 'middle_east';
        if (in_array($p2, self::$ASIAPAC_PREFIXES, true)) return 'asia_pacific';
        if ($p1 === 'K' || $p1 === 'C' || in_array($p2, ['SB','TI','MD'], true)) return 'americas';
        return 'other';
    }

    public static function getSeasonMultiplier(\DateTime $date, ?string $destinationIcao): float
    {
        $month  = (int) $date->format('n');
        $region = self::getRegion($destinationIcao);

        switch ($region) {
            case 'africa':
                if (in_array($month, [11,12,1,2], true)) return 1.30;
                if (in_array($month, [6,7,8], true))     return 1.05;
                if (in_array($month, [9,10], true))      return 1.00;
                return 0.85;

            case 'europe':
                if (in_array($month, [6,7,8], true))     return 1.40;
                if (in_array($month, [12,1], true))      return 1.20;
                if (in_array($month, [4,5,9,10], true))  return 1.05;
                return 0.85;

            case 'middle_east':
                if (in_array($month, [11,12,1,2,3], true)) return 1.25;
                if (in_array($month, [4,10], true))         return 1.00;
                return 0.78;

            case 'americas':
                if (in_array($month, [6,7,8], true))    return 1.35;
                if (in_array($month, [12,1], true))     return 1.25;
                if (in_array($month, [4,5,9,10], true)) return 1.00;
                return 0.85;

            case 'asia_pacific':
                if (in_array($month, [7,8], true))        return 1.28;
                if (in_array($month, [12,1], true))       return 1.22;
                if (in_array($month, [4,5,10,11], true))  return 1.05;
                if (in_array($month, [2,3,6], true))      return 0.90;
                return 1.00;

            default:
                if (in_array($month, [6,7,8,12], true))  return 1.25;
                if (in_array($month, [4,5,9,10], true))  return 1.05;
                return 0.88;
        }
    }

    public static function getSeasonLabel(\DateTime $date, ?string $destinationIcao): string
    {
        $multiplier = self::getSeasonMultiplier($date, $destinationIcao);
        if ($multiplier >= 1.30) return 'peak';
        if ($multiplier >= 1.10) return 'high';
        if ($multiplier >= 0.95) return 'shoulder';
        return 'low';
    }

    public static function baseFare(int $distanceKm): int
    {
        $yieldTaper = $distanceKm > 5000 ? 0.80 : 1.0;
        return max(45, (int) round($distanceKm * 0.065 * $yieldTaper));
    }

    public static function getDemandMultiplier(float $loadFactor): float
    {
        foreach (self::DEMAND_TIERS as $tier) {
            if ($loadFactor >= $tier['threshold']) return $tier['multiplier'];
        }
        return 0.70;
    }

    public static function calculatePrice(
        int $distanceKm,
        string $cabinClass,
        \DateTime $travelDate,
        float $loadFactor = 0.6,
        int $passengers = 1,
        ?string $destinationIcao = null
    ): array {
        $base             = self::baseFare($distanceKm);
        $classMultiplier  = self::CLASS_MULTIPLIERS[$cabinClass] ?? 1.0;
        $seasonMultiplier = self::getSeasonMultiplier($travelDate, $destinationIcao);
        $demandMultiplier = self::getDemandMultiplier($loadFactor);
        $fuelMultiplier   = OilPriceService::getFuelMultiplier();
        $taxes            = 45;

        $fuelAdjustedBase = $base * (0.70 + 0.30 * $fuelMultiplier);
        $perPerson        = (int) round($fuelAdjustedBase * $classMultiplier * $seasonMultiplier * $demandMultiplier + $taxes);
        $total            = $perPerson * $passengers;

        return [
            'perPerson' => $perPerson,
            'total'     => $total,
            'breakdown' => [
                'base'              => $base,
                'fuelAdjustedBase'  => (int) round($fuelAdjustedBase),
                'classMultiplier'   => $classMultiplier,
                'seasonMultiplier'  => $seasonMultiplier,
                'demandMultiplier'  => $demandMultiplier,
                'fuelMultiplier'    => round($fuelMultiplier, 3),
                'taxes'             => $taxes,
                'passengers'        => $passengers,
                'season'            => self::getSeasonLabel($travelDate, $destinationIcao),
                'region'            => self::getRegion($destinationIcao),
            ],
        ];
    }

    public static function allClassPrices(
        int $distanceKm,
        \DateTime $travelDate,
        float $loadFactor = 0.6,
        ?string $destinationIcao = null
    ): array {
        return [
            'economy'  => self::calculatePrice($distanceKm, 'economy',  $travelDate, $loadFactor, 1, $destinationIcao),
            'business' => self::calculatePrice($distanceKm, 'business', $travelDate, $loadFactor, 1, $destinationIcao),
            'first'    => self::calculatePrice($distanceKm, 'first',    $travelDate, $loadFactor, 1, $destinationIcao),
        ];
    }

    public static function getPricingFactors(?\DateTime $date = null): array
    {
        $date ??= new \DateTime();
        $probes = [
            'africa'      => 'FQMA',
            'europe'      => 'LFPG',
            'middle_east' => 'OMDB',
            'americas'    => 'KORD',
            'asia_pacific'=> 'WSSS',
        ];

        $seasonal = [];
        foreach ($probes as $region => $probe) {
            $seasonal[$region] = [
                'multiplier' => self::getSeasonMultiplier($date, $probe),
                'label'      => self::getSeasonLabel($date, $probe),
            ];
        }

        return [
            'oil'       => OilPriceService::getOilContext(),
            'seasonal'  => $seasonal,
            'updatedAt' => (new \DateTime())->format('c'),
        ];
    }
}

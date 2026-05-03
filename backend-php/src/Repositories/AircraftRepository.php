<?php

declare(strict_types=1);

namespace AFV\Repositories;

class AircraftRepository
{
    private static function mapAircraft(?array $row): ?array
    {
        if (!$row) return null;
        return [
            'id'               => $row['id'],
            'registration'     => $row['registration'],
            'type'             => $row['type'],
            'category'         => $row['category'],
            'hub'              => $row['hub'],
            'hub_name'         => $row['hub_name'],
            'seats'            => [
                'economy'  => $row['economy_seats'],
                'business' => $row['business_seats'],
                'first'    => $row['first_seats'],
            ],
            'range_km'         => $row['range_km'],
            'cruise_speed_kmh' => $row['cruise_speed_kmh'],
            'status'           => $row['status'],
            'image'            => $row['image'],
            'description'      => $row['description'],
        ];
    }

    public static function listAll(array $filters = []): array
    {
        $clauses = [];
        $values  = [];

        if (!empty($filters['hub'])) {
            $clauses[] = 'hub = ?';
            $values[]  = strtoupper($filters['hub']);
        }
        if (!empty($filters['category'])) {
            $clauses[] = 'LOWER(category) = LOWER(?)';
            $values[]  = $filters['category'];
        }

        $where = $clauses ? 'WHERE ' . implode(' AND ', $clauses) : '';
        $stmt  = Database::getConnection()->prepare("SELECT * FROM aircraft {$where} ORDER BY id ASC");
        $stmt->execute($values);
        return array_map(fn($r) => self::mapAircraft($r), $stmt->fetchAll());
    }

    public static function findByIdOrRegistration(string|int $idOrReg): ?array
    {
        $stmt = Database::getConnection()->prepare(
            "SELECT * FROM aircraft WHERE id = ? OR registration = ? LIMIT 1"
        );
        $stmt->execute([(int) $idOrReg, (string) $idOrReg]);
        return self::mapAircraft($stmt->fetch() ?: null);
    }

    public static function create(array $data): ?array
    {
        $stmt = Database::getConnection()->prepare(
            "INSERT INTO aircraft (registration, type, category, hub, hub_name, economy_seats, business_seats, first_seats, range_km, cruise_speed_kmh, status, image, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            $data['registration'], $data['type'], $data['category'],
            $data['hub'], $data['hub_name'],
            $data['seats']['economy']  ?? 0,
            $data['seats']['business'] ?? 0,
            $data['seats']['first']    ?? 0,
            $data['range_km']          ?? 0,
            $data['cruise_speed_kmh']  ?? 0,
            $data['status']            ?? 'active',
            $data['image']             ?? null,
            $data['description']       ?? null,
        ]);
        return self::findByIdOrRegistration((int) Database::getConnection()->lastInsertId());
    }

    public static function update(int $id, array $data): ?array
    {
        $stmt = Database::getConnection()->prepare(
            "UPDATE aircraft SET registration=?, type=?, category=?, hub=?, hub_name=?, economy_seats=?, business_seats=?, first_seats=?, range_km=?, cruise_speed_kmh=?, status=?, image=?, description=? WHERE id=?"
        );
        $stmt->execute([
            $data['registration'], $data['type'], $data['category'],
            $data['hub'], $data['hub_name'],
            $data['seats']['economy']  ?? 0,
            $data['seats']['business'] ?? 0,
            $data['seats']['first']    ?? 0,
            $data['range_km']          ?? 0,
            $data['cruise_speed_kmh']  ?? 0,
            $data['status']            ?? 'active',
            $data['image']             ?? null,
            $data['description']       ?? null,
            $id,
        ]);
        return self::findByIdOrRegistration($id);
    }

    public static function retire(int $id): ?array
    {
        $stmt = Database::getConnection()->prepare("UPDATE aircraft SET status = 'retired' WHERE id = ?");
        $stmt->execute([$id]);
        return self::findByIdOrRegistration($id);
    }

    public static function countActive(): int
    {
        return (int) Database::getConnection()->query("SELECT COUNT(*) FROM aircraft WHERE status = 'active'")->fetchColumn();
    }
}

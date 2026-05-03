<?php

declare(strict_types=1);

namespace AFV\Repositories;

class UserRepository
{
    private static function mapUser(?array $row): ?array
    {
        if (!$row) return null;
        return [
            'id'              => $row['id'],
            'name'            => $row['name'],
            'email'           => $row['email'],
            'password'        => $row['password'],
            'vatsimCid'       => $row['vatsim_cid'],
            'role'            => $row['role'],
            'isPrimaryAdmin'  => (bool) $row['is_primary_admin'],
            'createdByUserId' => $row['created_by_user_id'],
            'createdByName'   => $row['created_by_name'] ?? null,
            'joinedAt'        => $row['joined_at'],
            'flightHours'     => $row['flight_hours'],
            'points'          => $row['points'],
        ];
    }

    public static function toSafeUser(?array $user): ?array
    {
        if (!$user) return null;
        $safe = $user;
        unset($safe['password']);
        return $safe;
    }

    public static function findByEmail(string $email): ?array
    {
        $stmt = Database::getConnection()->prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1");
        $stmt->execute([$email]);
        return self::mapUser($stmt->fetch() ?: null);
    }

    public static function findById(int $id): ?array
    {
        $stmt = Database::getConnection()->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$id]);
        return self::mapUser($stmt->fetch() ?: null);
    }

    public static function create(array $params): ?array
    {
        $stmt = Database::getConnection()->prepare(
            "INSERT INTO users (name, email, password, vatsim_cid, role, is_primary_admin, created_by_user_id, joined_at, flight_hours, points)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 0, 0)"
        );
        $stmt->execute([
            $params['name'],
            $params['email'],
            $params['password'],
            $params['vatsimCid']       ?? null,
            $params['role']            ?? 'user',
            ($params['isPrimaryAdmin'] ?? false) ? 1 : 0,
            $params['createdByUserId'] ?? null,
        ]);
        return self::findById((int) Database::getConnection()->lastInsertId());
    }

    public static function listAll(): array
    {
        $rows = Database::getConnection()->query(
            "SELECT users.*, creators.name AS created_by_name
             FROM users
             LEFT JOIN users AS creators ON creators.id = users.created_by_user_id
             ORDER BY users.is_primary_admin DESC, users.joined_at DESC"
        )->fetchAll();
        return array_map(fn($r) => self::mapUser($r), $rows);
    }

    public static function updateRole(int $id, string $role): ?array
    {
        $stmt = Database::getConnection()->prepare("UPDATE users SET role = ? WHERE id = ?");
        $stmt->execute([$role, $id]);
        return self::findById($id);
    }

    public static function count(): int
    {
        return (int) Database::getConnection()->query("SELECT COUNT(*) FROM users")->fetchColumn();
    }
}

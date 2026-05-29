<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/helpers.php';

cors_headers();
$method = $_SERVER['REQUEST_METHOD'];
$path   = api_path('/api/auth');

// POST /api/auth/register
if ($method === 'POST' && $path === 'register') {
    $body      = req_body();
    $name      = trim((string)($body['name']     ?? ''));
    $email     = trim((string)($body['email']    ?? ''));
    $password  = (string)($body['password'] ?? '');
    $vatsimCid = trim((string)($body['vatsimCid'] ?? '')) ?: null;

    if (!$name || !$email || !$password) json_err('name, email and password are required');
    if (find_user_by_email($email)) json_err('Email already registered', 409);

    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
    $stmt = db()->prepare("INSERT INTO users (name,email,password,vatsim_cid,role,is_primary_admin,created_by_user_id,joined_at,flight_hours,points) VALUES (?,?,?,?,'user',0,NULL,NOW(),0,0)");
    $stmt->execute([$name, strtolower($email), $hash, $vatsimCid]);
    $user  = find_user_by_id((int) db()->lastInsertId());
    json_ok(['token' => jwt_sign($user), 'user' => safe_user($user)], 201);
}

// POST /api/auth/login
if ($method === 'POST' && $path === 'login') {
    $body  = req_body();
    $email = trim((string)($body['email']    ?? ''));
    $pass  = (string)($body['password'] ?? '');
    $user  = find_user_by_email($email);
    if (!$user || !password_verify($pass, $user['password'])) json_err('Invalid credentials', 401);
    json_ok(['token' => jwt_sign($user), 'user' => safe_user($user)]);
}

// GET /api/auth/me
if ($method === 'GET' && $path === 'me') {
    $jwt  = require_auth();
    $user = find_user_by_id((int)$jwt['id']);
    if (!$user) json_err('User not found', 404);
    json_ok(safe_user($user));
}

json_err('Not found', 404);

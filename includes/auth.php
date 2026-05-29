<?php
declare(strict_types=1);

// ── Global error → JSON (prevents HTML error pages reaching the JS) ───────────

set_exception_handler(function (Throwable $e): void {
    $status = ($e instanceof RuntimeException && $e->getCode() >= 400 && $e->getCode() < 600)
        ? $e->getCode()
        : 500;
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    exit;
});

set_error_handler(function (int $errno, string $errstr, string $errfile, int $errline): bool {
    throw new ErrorException($errstr, 500, $errno, $errfile, $errline);
});

// ── CORS ─────────────────────────────────────────────────────────────────────

function cors_headers(): void {
    $origin = getenv('CORS_ORIGIN') ?: '*';
    header("Access-Control-Allow-Origin: {$origin}");
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Credentials: true');
    header('Content-Type: application/json; charset=utf-8');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
}

// ── JSON helpers ──────────────────────────────────────────────────────────────

function json_ok(mixed $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_err(string $message, int $status = 400): never {
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function req_body(): array {
    static $body = null;
    if ($body === null) {
        $raw  = (string) file_get_contents('php://input');
        $body = json_decode($raw, true) ?? [];
    }
    return $body;
}

function api_path(string $prefix): string {
    $uri  = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $path = preg_replace('#^' . preg_quote($prefix, '#') . '#', '', (string) $uri);
    return trim($path, '/');
}

// ── HS256 JWT (no library needed) ────────────────────────────────────────────

function _b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function _b64url_decode(string $data): string {
    return (string) base64_decode(strtr($data, '-_', '+/'));
}

function jwt_sign(array $user): string {
    $secret  = getenv('JWT_SECRET') ?: 'afv_secret_change_in_production';
    $header  = _b64url_encode((string) json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    $payload = _b64url_encode((string) json_encode([
        'id'             => $user['id'],
        'email'          => $user['email'],
        'name'           => $user['name'],
        'role'           => $user['role'],
        'isPrimaryAdmin' => (bool) ($user['isPrimaryAdmin'] ?? false),
        'iat'            => time(),
        'exp'            => time() + 86400,
    ]));
    $sig = _b64url_encode(hash_hmac('sha256', "{$header}.{$payload}", $secret, true));
    return "{$header}.{$payload}.{$sig}";
}

function jwt_verify(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $payload, $sig] = $parts;
    $secret   = getenv('JWT_SECRET') ?: 'afv_secret_change_in_production';
    $expected = _b64url_encode(hash_hmac('sha256', "{$header}.{$payload}", $secret, true));
    if (!hash_equals($expected, $sig)) return null;
    $data = json_decode(_b64url_decode($payload), true);
    if (!$data || (int) ($data['exp'] ?? 0) < time()) return null;
    return $data;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

function auth_user(): ?array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!$header || !str_starts_with($header, 'Bearer ')) return null;
    return jwt_verify(substr($header, 7));
}

function require_auth(): array {
    $user = auth_user();
    if (!$user) json_err('Authentication required', 401);
    return $user;
}

function require_admin(): array {
    $user = require_auth();
    if (($user['role'] ?? '') !== 'admin') json_err('Admin access required', 403);
    return $user;
}

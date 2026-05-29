<?php
declare(strict_types=1);

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// ── API routing ────────────────────────────────────────────────────────────────
$apiMap = [
    '/api/auth'     => __DIR__ . '/api/auth.php',
    '/api/flights'  => __DIR__ . '/api/flights.php',
    '/api/bookings' => __DIR__ . '/api/bookings.php',
    '/api/fleet'    => __DIR__ . '/api/fleet.php',
    '/api/admin'    => __DIR__ . '/api/admin.php',
    '/api/vatsim'   => __DIR__ . '/api/vatsim.php',
    '/api/health'   => __DIR__ . '/api/health.php',
];

foreach ($apiMap as $prefix => $script) {
    if ($uri === $prefix || str_starts_with($uri, $prefix . '/')) {
        require $script;
        return;
    }
}

// ── Static files (assets, data, etc.) ─────────────────────────────────────────
$file = __DIR__ . urldecode($uri);
if (is_file($file) && pathinfo($file, PATHINFO_EXTENSION) !== 'php') {
    $mime = match (strtolower(pathinfo($file, PATHINFO_EXTENSION))) {
        'css'         => 'text/css',
        'js'          => 'application/javascript',
        'json'        => 'application/json',
        'png'         => 'image/png',
        'jpg', 'jpeg' => 'image/jpeg',
        'gif'         => 'image/gif',
        'svg'         => 'image/svg+xml',
        'ico'         => 'image/x-icon',
        'woff'        => 'font/woff',
        'woff2'       => 'font/woff2',
        'ttf'         => 'font/ttf',
        'webp'        => 'image/webp',
        'pdf'         => 'application/pdf',
        default       => 'application/octet-stream',
    };
    header("Content-Type: $mime");
    readfile($file);
    return;
}

// ── PHP pages (/routes → routes.php  or  /routes.php → routes.php) ───────────
$page    = trim($uri, '/') ?: 'index';
$phpFile = str_ends_with($page, '.php')
    ? __DIR__ . '/' . $page
    : __DIR__ . '/' . $page . '.php';
if (is_file($phpFile)) {
    require $phpFile;
    return;
}

// ── Fallback → homepage ───────────────────────────────────────────────────────
require __DIR__ . '/index.php';

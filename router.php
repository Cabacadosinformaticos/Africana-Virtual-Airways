<?php

declare(strict_types=1);

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// API requests → PHP backend
if (str_starts_with($uri, '/api/')) {
    require __DIR__ . '/backend-php/public/index.php';
    return;
}

// Static files from frontend/
$file = __DIR__ . '/frontend' . urldecode($uri);
if (is_file($file)) {
    $mime = match (strtolower(pathinfo($file, PATHINFO_EXTENSION))) {
        'html'        => 'text/html; charset=utf-8',
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
        default       => 'application/octet-stream',
    };
    header("Content-Type: $mime");
    readfile($file);
    return;
}

// Fallback → frontend index.html
header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/frontend/index.html');

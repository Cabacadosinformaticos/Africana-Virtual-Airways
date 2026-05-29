<?php
declare(strict_types=1);
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/auth.php';
cors_headers();
json_ok(['status' => 'ok', 'timestamp' => (new DateTime())->format('c')]);

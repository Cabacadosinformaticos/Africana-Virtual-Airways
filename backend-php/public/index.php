<?php

declare(strict_types=1);

define('PROJECT_ROOT', dirname(__DIR__, 2));

require dirname(__DIR__) . '/vendor/autoload.php';

use AFV\Repositories\Database;
use AFV\Services\OilPriceService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Slim\Factory\AppFactory;

// ── Environment ──────────────────────────────────────────────────────────────

$dotenv = Dotenv\Dotenv::createUnsafeImmutable(PROJECT_ROOT);
$dotenv->safeLoad();

// ── Bootstrap ────────────────────────────────────────────────────────────────

Database::initialize();

try {
    OilPriceService::refreshOilPrice();
} catch (\Throwable) {
    // Non-fatal — fallback multiplier used
}

// ── App ───────────────────────────────────────────────────────────────────────

$app = AppFactory::create();
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();

// ── Helpers ───────────────────────────────────────────────────────────────────

function json_ok(Response $response, mixed $data, int $status = 200): Response
{
    $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    return $response
        ->withHeader('Content-Type', 'application/json')
        ->withStatus($status);
}

function json_error(Response $response, string $message, int $status = 400): Response
{
    $response->getBody()->write(json_encode(['error' => $message], JSON_UNESCAPED_UNICODE));
    return $response
        ->withHeader('Content-Type', 'application/json')
        ->withStatus($status);
}

// ── CORS ──────────────────────────────────────────────────────────────────────

$app->add(function (Request $request, RequestHandler $handler): Response {
    if ($request->getMethod() === 'OPTIONS') {
        $response = new \Slim\Psr7\Response();
    } else {
        $response = $handler->handle($request);
    }

    $origin = $_ENV['CORS_ORIGIN'] ?? '*';

    return $response
        ->withHeader('Access-Control-Allow-Origin', $origin)
        ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ->withHeader('Access-Control-Allow-Credentials', 'true');
});

$app->options('/{routes:.+}', function (Request $request, Response $response): Response {
    return $response;
});

// ── Error handler ────────────────────────────────────────────────────────────

$errorMiddleware = $app->addErrorMiddleware(false, false, false);
$errorMiddleware->setDefaultErrorHandler(function (
    Request $request,
    \Throwable $exception,
    bool $displayErrorDetails
): Response {
    $status  = ($exception instanceof \RuntimeException && $exception->getCode() >= 400 && $exception->getCode() < 600)
        ? $exception->getCode()
        : 500;
    $message = ($status < 500) ? $exception->getMessage() : 'Internal server error';

    $response = new \Slim\Psr7\Response();
    $response->getBody()->write(json_encode(['error' => $message]));
    return $response->withHeader('Content-Type', 'application/json')->withStatus($status);
});

// ── Health ────────────────────────────────────────────────────────────────────

$app->get('/api/health', function (Request $request, Response $response): Response {
    return json_ok($response, ['status' => 'ok', 'timestamp' => (new \DateTime())->format('c')]);
});

// ── Routes ────────────────────────────────────────────────────────────────────

$routeDir = __DIR__ . '/../src/Routes';
(require "{$routeDir}/auth.php")($app);
(require "{$routeDir}/flights.php")($app);
(require "{$routeDir}/fleet.php")($app);
(require "{$routeDir}/bookings.php")($app);
(require "{$routeDir}/admin.php")($app);
(require "{$routeDir}/vatsim.php")($app);

// ── Frontend fallback ─────────────────────────────────────────────────────────

$app->get('/', function (Request $request, Response $response): Response {
    $frontendIndex = PROJECT_ROOT . '/frontend/index.html';
    if (file_exists($frontendIndex)) {
        $response->getBody()->write((string) file_get_contents($frontendIndex));
        return $response->withHeader('Content-Type', 'text/html');
    }
    return json_ok($response, ['status' => 'ok', 'timestamp' => (new \DateTime())->format('c')]);
});

$app->get('/{routes:.+}', function (Request $request, Response $response, array $args): Response {
    $path = $args['routes'] ?? '';

    // Serve frontend HTML pages by name (e.g. /vatsim.html → frontend/vatsim.html)
    if (preg_match('/^[a-zA-Z0-9_-]+\.html$/', $path)) {
        $frontendFile = PROJECT_ROOT . '/frontend/' . $path;
        if (file_exists($frontendFile)) {
            $response->getBody()->write((string) file_get_contents($frontendFile));
            return $response->withHeader('Content-Type', 'text/html');
        }
    }

    $frontendIndex = PROJECT_ROOT . '/frontend/index.html';
    if (file_exists($frontendIndex)) {
        $response->getBody()->write((string) file_get_contents($frontendIndex));
        return $response->withHeader('Content-Type', 'text/html');
    }
    return json_error($response, 'Not found', 404);
});

// ── Run ───────────────────────────────────────────────────────────────────────

$app->run();

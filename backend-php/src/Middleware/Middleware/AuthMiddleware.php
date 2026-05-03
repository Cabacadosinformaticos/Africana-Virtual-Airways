<?php

declare(strict_types=1);

namespace AFV\Middleware\Middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

class AuthMiddleware implements MiddlewareInterface
{
    public function process(Request $request, RequestHandler $handler): Response
    {
        $authHeader = $request->getHeaderLine('Authorization');
        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return self::errorResponse(401, 'Authentication required');
        }

        $token = substr($authHeader, 7);
        try {
            $secret  = getenv('JWT_SECRET') ?: 'afv_secret_change_in_production';
            $decoded = JWT::decode($token, new Key($secret, 'HS256'));
            $request = $request->withAttribute('user', (array) $decoded);
        } catch (\Throwable $e) {
            return self::errorResponse(401, 'Invalid or expired token');
        }

        return $handler->handle($request);
    }

    public static function signToken(array $user): string
    {
        $secret  = getenv('JWT_SECRET') ?: 'afv_secret_change_in_production';
        $payload = [
            'id'             => $user['id'],
            'email'          => $user['email'],
            'name'           => $user['name'],
            'role'           => $user['role'],
            'isPrimaryAdmin' => (bool) ($user['isPrimaryAdmin'] ?? false),
            'iat'            => time(),
            'exp'            => time() + 86400,
        ];
        return JWT::encode($payload, $secret, 'HS256');
    }

    public static function errorResponse(int $status, string $message): Response
    {
        $response = new \Slim\Psr7\Response($status);
        $response->getBody()->write(json_encode(['error' => $message]));
        return $response->withHeader('Content-Type', 'application/json');
    }
}

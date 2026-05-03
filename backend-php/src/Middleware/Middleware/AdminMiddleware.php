<?php

declare(strict_types=1);

namespace AFV\Middleware\Middleware;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;

class AdminMiddleware implements MiddlewareInterface
{
    public function process(Request $request, RequestHandler $handler): Response
    {
        $authHeader = $request->getHeaderLine('Authorization');
        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return AuthMiddleware::errorResponse(401, 'Authentication required');
        }

        $token = substr($authHeader, 7);
        try {
            $secret  = getenv('JWT_SECRET') ?: 'afv_secret_change_in_production';
            $decoded = JWT::decode($token, new Key($secret, 'HS256'));
            $user    = (array) $decoded;
        } catch (\Throwable $e) {
            return AuthMiddleware::errorResponse(401, 'Invalid or expired token');
        }

        if (($user['role'] ?? '') !== 'admin') {
            return AuthMiddleware::errorResponse(403, 'Admin access required');
        }

        return $handler->handle($request->withAttribute('user', $user));
    }
}

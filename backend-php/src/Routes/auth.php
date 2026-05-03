<?php

declare(strict_types=1);

use AFV\Middleware\Middleware\AuthMiddleware;
use AFV\Repositories\UserRepository;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;

return function (App $app): void {

    $app->post('/api/auth/register', function (Request $request, Response $response): Response {
        $body = (array) $request->getParsedBody();
        $name     = trim((string) ($body['name']     ?? ''));
        $email    = trim((string) ($body['email']    ?? ''));
        $password = (string) ($body['password'] ?? '');
        $vatsimCid = trim((string) ($body['vatsimCid'] ?? '')) ?: null;

        if (!$name || !$email || !$password) {
            return json_error($response, 'name, email and password are required', 400);
        }

        if (UserRepository::findByEmail($email)) {
            return json_error($response, 'Email already registered', 409);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
        $user = UserRepository::create(['name' => $name, 'email' => strtolower($email), 'password' => $hash, 'vatsimCid' => $vatsimCid]);
        $token = AuthMiddleware::signToken($user);

        return json_ok($response, ['token' => $token, 'user' => UserRepository::toSafeUser($user)], 201);
    });

    $app->post('/api/auth/login', function (Request $request, Response $response): Response {
        $body  = (array) $request->getParsedBody();
        $email = trim((string) ($body['email']    ?? ''));
        $pass  = (string) ($body['password'] ?? '');

        $user = UserRepository::findByEmail($email);
        if (!$user || !password_verify($pass, $user['password'])) {
            return json_error($response, 'Invalid credentials', 401);
        }

        $token = AuthMiddleware::signToken($user);
        return json_ok($response, ['token' => $token, 'user' => UserRepository::toSafeUser($user)]);
    });

    $app->get('/api/auth/me', function (Request $request, Response $response): Response {
        $jwtUser = $request->getAttribute('user');
        $user    = UserRepository::findById((int) $jwtUser['id']);
        if (!$user) return json_error($response, 'User not found', 404);
        return json_ok($response, UserRepository::toSafeUser($user));
    })->add(new \AFV\Middleware\Middleware\AuthMiddleware());

};

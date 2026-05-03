<?php

declare(strict_types=1);

use AFV\Middleware\Middleware\AdminMiddleware;
use AFV\Repositories\AircraftRepository;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;

return function (App $app): void {

    $app->get('/api/fleet', function (Request $request, Response $response): Response {
        return json_ok($response, AircraftRepository::listAll($request->getQueryParams()));
    });

    $app->get('/api/fleet/{id}', function (Request $request, Response $response, array $args): Response {
        $aircraft = AircraftRepository::findByIdOrRegistration($args['id']);
        if (!$aircraft) return json_error($response, 'Aircraft not found', 404);
        return json_ok($response, $aircraft);
    });

    $app->post('/api/fleet', function (Request $request, Response $response): Response {
        $aircraft = AircraftRepository::create((array) $request->getParsedBody());
        return json_ok($response, $aircraft, 201);
    })->add(new AdminMiddleware());

    $app->put('/api/fleet/{id}', function (Request $request, Response $response, array $args): Response {
        $existing = AircraftRepository::findByIdOrRegistration($args['id']);
        if (!$existing) return json_error($response, 'Aircraft not found', 404);
        $aircraft = AircraftRepository::update($existing['id'], array_merge($existing, (array) $request->getParsedBody()));
        return json_ok($response, $aircraft);
    })->add(new AdminMiddleware());

    $app->delete('/api/fleet/{id}', function (Request $request, Response $response, array $args): Response {
        $existing = AircraftRepository::findByIdOrRegistration($args['id']);
        if (!$existing) return json_error($response, 'Aircraft not found', 404);
        AircraftRepository::retire($existing['id']);
        return json_ok($response, ['message' => 'Aircraft retired']);
    })->add(new AdminMiddleware());

};

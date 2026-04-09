# API Guide

## Base URL

Local development:

```text
http://localhost:3000/api
```

## Authentication

Authentication is JWT-based.

- Public routes do not require a token.
- Protected routes expect `Authorization: Bearer <token>`.
- Admin routes require a valid token for a user with the `admin` role.

Token generation is handled in [`apps/api/src/middlewares/auth-middleware.js`](D:/Escola/projetos-do-git/IADE_AFVsite-master/apps/api/src/middlewares/auth-middleware.js).

## Route Groups

### Health

- `GET /health`

Returns service metadata such as status, environment, and uptime.

### Authentication

Source: [`apps/api/src/routes/auth-routes.js`](D:/Escola/projetos-do-git/IADE_AFVsite-master/apps/api/src/routes/auth-routes.js)

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Typical auth payloads:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "strong-password",
  "vatsimCid": "1234567"
}
```

```json
{
  "email": "jane@example.com",
  "password": "strong-password"
}
```

### Flights

Source: [`apps/api/src/routes/flights-routes.js`](D:/Escola/projetos-do-git/IADE_AFVsite-master/apps/api/src/routes/flights-routes.js)

- `GET /flights/search?from=FQMA&to=FAOR&date=2026-04-20&passengers=1`
- `GET /flights/routes`
- `GET /flights/airports`
- `POST /flights/itinerary`
- `GET /flights/pricing-factors`
- `POST /flights/seat-map`

`/flights/search` searches the configured AFV route network and returns itinerary options.

`/flights/itinerary` validates a selected itinerary and returns repriced totals for all cabins.

`/flights/seat-map` returns occupied seats for the itinerary and cabin class provided.

### Fleet

Source: [`apps/api/src/routes/fleet-routes.js`](D:/Escola/projetos-do-git/IADE_AFVsite-master/apps/api/src/routes/fleet-routes.js)

- `GET /fleet`
- `GET /fleet/:id`
- `POST /fleet`
- `PUT /fleet/:id`
- `DELETE /fleet/:id`

Only the `GET` routes are public. Create, update, and delete operations require admin access.

### Bookings

Source: [`apps/api/src/routes/bookings-routes.js`](D:/Escola/projetos-do-git/IADE_AFVsite-master/apps/api/src/routes/bookings-routes.js)

- `POST /bookings`
- `GET /bookings/my`
- `GET /bookings/lookup?ref=AFVXXXXXX&email=user@example.com`
- `GET /bookings/:ref`
- `PUT /bookings/:ref/cancel`

Booking creation expects:

```json
{
  "itinerary": {
    "from": "FQMA",
    "to": "FAOR",
    "date": "2026-04-20",
    "segments": []
  },
  "cabinClass": "economy",
  "passengers": 1,
  "seat": "12A",
  "passengerDetails": [
    {
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com"
    }
  ]
}
```

Key behaviors:

- itinerary data is revalidated server-side
- pricing is recalculated server-side
- seat conflicts are checked before persisting the booking
- if the user is authenticated, the booking is linked to that user

### Admin

Source: [`apps/api/src/routes/admin-routes.js`](D:/Escola/projetos-do-git/IADE_AFVsite-master/apps/api/src/routes/admin-routes.js)

All routes below require admin access:

- `GET /admin/stats`
- `GET /admin/users`
- `POST /admin/users`
- `PUT /admin/users/:id/role`
- `GET /admin/bookings`
- `PUT /admin/bookings/:ref/status`
- `GET /admin/fleet`
- `GET /admin/lookups`
- `GET /admin/routes`
- `POST /admin/routes`
- `PUT /admin/routes/:id`
- `GET /admin/airline-stats`
- `PUT /admin/airline-stats`

Additional rule:

- user creation and role changes for other admins are restricted to the primary admin

### VATSIM

Source: [`apps/api/src/routes/vatsim-routes.js`](D:/Escola/projetos-do-git/IADE_AFVsite-master/apps/api/src/routes/vatsim-routes.js)

- `GET /vatsim/online`
- `GET /vatsim/stats`

`/vatsim/online` fetches live data from VATSIM, filters AFV callsigns, enriches pilots with timing and destination weather data, and caches the result briefly in memory.

## Error Handling

General error behavior:

- validation errors typically return `400`
- authentication failures return `401`
- authorization failures return `403`
- missing resources return `404`
- unhandled errors return `500`

The API also applies rate limiting under `/api/*`.

## Security Behavior

The server uses:

- Helmet for HTTP security headers
- CORS with permissive behavior in development and a production origin restriction
- `express-rate-limit` for API throttling
- JWT tokens with 24-hour expiry

## Related Files

- API entry point: [`apps/api/src/server.js`](D:/Escola/projetos-do-git/IADE_AFVsite-master/apps/api/src/server.js)
- Auth middleware: [`apps/api/src/middlewares/auth-middleware.js`](D:/Escola/projetos-do-git/IADE_AFVsite-master/apps/api/src/middlewares/auth-middleware.js)
- Database bootstrap: [`apps/api/src/repositories/database.js`](D:/Escola/projetos-do-git/IADE_AFVsite-master/apps/api/src/repositories/database.js)
- Schema: [`database/schema/mysql.sql`](D:/Escola/projetos-do-git/IADE_AFVsite-master/database/schema/mysql.sql)

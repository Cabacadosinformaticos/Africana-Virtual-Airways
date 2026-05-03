# Africana Virtual Airways — REST API Documentation

**Framework:** Slim 4 (PHP)  
**Base URL:** `/api`  
**Data format:** JSON (all requests and responses)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Global Response Format](#global-response-format)
3. [Error Codes](#error-codes)
4. [Environment Variables](#environment-variables)
5. [Endpoints](#endpoints)
   - [Health](#health)
   - [Auth](#auth)
   - [Flights](#flights)
   - [Fleet](#fleet)
   - [Bookings](#bookings)
   - [Admin](#admin)
   - [VATSIM](#vatsim)
6. [Data Models](#data-models)
7. [Pricing Logic](#pricing-logic)
8. [Endpoint Summary](#endpoint-summary)

---

## Authentication

The API uses **JWT (JSON Web Tokens)** signed with HS256.

### Token structure

| Field | Type | Description |
|---|---|---|
| `id` | int | User ID |
| `email` | string | User email |
| `name` | string | Display name |
| `role` | string | `admin` or `user` |
| `isPrimaryAdmin` | bool | Primary admin flag |
| `iat` | int | Issued-at timestamp |
| `exp` | int | Expiry timestamp (24 hours) |

### How to send the token

```
Authorization: Bearer <token>
```

### Middleware levels

| Level | Behaviour |
|---|---|
| **None** | Public — no token required |
| **Optional** | Token is read if present and user is attached to the request |
| **Required** | Returns `401` if token is missing or invalid |
| **Admin** | Returns `403` if the token is valid but the role is not `admin` |
| **Primary admin** | Returns `403` if the user is not the primary admin |

---

## Global Response Format

### Success

```json
{ "key": "value" }
```

Successful responses return the relevant object or array directly — there is no outer wrapper.

### Error

```json
{ "error": "Human-readable message" }
```

---

## Error Codes

| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Created |
| `400` | Bad Request — missing or invalid input |
| `401` | Unauthorized — token missing or expired |
| `403` | Forbidden — insufficient permissions |
| `404` | Not Found |
| `409` | Conflict — duplicate entry or seat already taken |
| `500` | Internal Server Error |

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `JWT_SECRET` | JWT signing secret |
| `DB_HOST` | MySQL host |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name (default: `afv_booking`) |
| `CORS_ORIGIN` | Allowed CORS origin (default: `*`) |

### Primary admin bootstrap

| Variable | Description |
|---|---|
| `PRIMARY_ADMIN_EMAIL` | Admin email |
| `PRIMARY_ADMIN_PASSWORD` | Admin password |
| `PRIMARY_ADMIN_NAME` | Admin display name |
| `PRIMARY_ADMIN_VATSIM_CID` | VATSIM CID |
| `PRIMARY_ADMIN_FLIGHT_HOURS` | Initial flight hours |
| `PRIMARY_ADMIN_POINTS` | Initial points |

### Optional

| Variable | Default | Description |
|---|---|---|
| `DB_PORT` | `3306` | MySQL port |
| `ALPHA_VANTAGE_KEY` | — | API key for live oil price (Brent crude) |

---

## Endpoints

---

### Health

#### `GET /api/health`

Returns the service status.

**Auth:** None

**Response `200`**

```json
{
  "status": "ok",
  "timestamp": "2024-06-15T08:00:00Z"
}
```

---

### Auth

#### `POST /api/auth/register`

Create a new user account.

**Auth:** None

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Display name |
| `email` | string | Yes | Email address |
| `password` | string | Yes | Password |
| `vatsimCid` | string | No | VATSIM CID |

**Response `201`**

```json
{
  "token": "<jwt>",
  "user": { ...User }
}
```

**Errors**

| Code | Reason |
|---|---|
| `400` | Missing required field |
| `409` | Email already registered |

---

#### `POST /api/auth/login`

Authenticate and receive a token.

**Auth:** None

**Request body**

| Field | Type | Required |
|---|---|---|
| `email` | string | Yes |
| `password` | string | Yes |

**Response `200`**

```json
{
  "token": "<jwt>",
  "user": { ...User }
}
```

**Errors**

| Code | Reason |
|---|---|
| `401` | Invalid credentials |

---

#### `GET /api/auth/me`

Return the authenticated user's profile.

**Auth:** Required

**Response `200`** — [User](#user) object (password excluded)

**Errors**

| Code | Reason |
|---|---|
| `401` | Token missing or invalid |
| `404` | User not found |

---

### Flights

#### `GET /api/flights/search`

Search for available itineraries between two airports.

**Auth:** None

**Query parameters**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `from` | string | Yes | — | Origin ICAO code (e.g. `FQMA`) |
| `to` | string | Yes | — | Destination ICAO code |
| `date` | string | No | 7 days from now | Travel date (`YYYY-MM-DD`) |
| `passengers` | int | No | `1` | Number of passengers (min 1) |

**Response `200`**

```json
{
  "origin": { ...Airport },
  "destination": { ...Airport },
  "travelDate": "2024-06-15",
  "itineraries": [
    {
      "itineraryId": "AFV101:2024-06-15",
      "stopCount": 0,
      "summary": "Non-stop",
      "durationMinutes": 360,
      "duration": "6h 00m",
      "layoverMinutes": 0,
      "segments": [ ...Segment ],
      "pricesPerPerson": {
        "economy": 450.00,
        "business": 1440.00,
        "first": 2925.00
      },
      "prices": {
        "economy": 900.00,
        "business": 2880.00,
        "first": 5850.00
      },
      "from": "FQMA",
      "to": "FAOR",
      "date": "2024-06-15"
    }
  ],
  "searchSummary": {
    "stopsOffered": false,
    "totalResults": 1
  }
}
```

**Notes**
- Uses BFS pathfinding (max 3 legs, min 90-minute layover).
- Returns up to 8 itineraries, sorted by stops then price.

**Errors**

| Code | Reason |
|---|---|
| `400` | `from` or `to` missing |
| `404` | Airport not found |

---

#### `GET /api/flights/routes`

List all active routes with coordinates.

**Auth:** None

**Response `200`** — Array of route objects including from/to airports, coordinates, distance, and hub info.

---

#### `GET /api/flights/airports`

List all airports in the network.

**Auth:** None

**Response `200`** — Map keyed by ICAO code.

```json
{
  "FQMA": { ...Airport },
  "FAOR": { ...Airport }
}
```

---

#### `POST /api/flights/itinerary`

Validate and hydrate a raw itinerary (adds exact times, prices, aircraft).

**Auth:** None

**Request body**

| Field | Type | Required |
|---|---|---|
| `itinerary` | object | Yes |
| `itinerary.segments` | array | Yes |
| `passengers` | int | No |

**Response `200`** — Hydrated itinerary object with full segment details and prices.

**Errors**

| Code | Reason |
|---|---|
| `400` | Invalid itinerary |

---

#### `POST /api/flights/seat-map`

Get occupied seats for an itinerary in a given cabin class.

**Auth:** None

**Request body**

| Field | Type | Required | Values |
|---|---|---|---|
| `itinerary` | object | Yes | |
| `itinerary.segments` | array | Yes | |
| `cabinClass` | string | Yes | `economy`, `business`, `first` |

**Response `200`**

```json
{
  "occupiedSeats": ["1A", "2B", "14C"]
}
```

**Errors**

| Code | Reason |
|---|---|
| `400` | Invalid itinerary or cabin class |

---

#### `GET /api/flights/pricing-factors`

Get the current pricing multipliers (oil price, seasonal).

**Auth:** None

**Query parameters**

| Parameter | Type | Required |
|---|---|---|
| `date` | string | No |

**Response `200`**

```json
{
  "oil": {
    "priceUSD": 82.50,
    "baseline": 80.00,
    "multiplier": 1.03,
    "source": "live",
    "cachedAt": "2024-06-15T06:00:00Z"
  },
  "seasonal": {
    "africa":         { "multiplier": 1.30, "label": "peak" },
    "europe":         { "multiplier": 1.10, "label": "high" },
    "americas":       { "multiplier": 1.00, "label": "shoulder" },
    "middleEast":     { "multiplier": 0.90, "label": "low" },
    "asiaPacific":    { "multiplier": 1.20, "label": "high" }
  },
  "updatedAt": "2024-06-15T06:00:00Z"
}
```

---

### Fleet

#### `GET /api/fleet`

List aircraft, with optional filters.

**Auth:** None

**Query parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `hub` | string | No | Filter by hub ICAO code |
| `category` | string | No | Filter by category |

**Response `200`** — Array of [Aircraft](#aircraft) objects.

---

#### `GET /api/fleet/{id}`

Get a single aircraft by ID or registration.

**Auth:** None

**Path parameters**

| Parameter | Description |
|---|---|
| `id` | Aircraft numeric ID or registration string (e.g. `ZS-XYZ`) |

**Response `200`** — [Aircraft](#aircraft) object.

**Errors**

| Code | Reason |
|---|---|
| `404` | Aircraft not found |

---

#### `POST /api/fleet`

Add a new aircraft to the fleet.

**Auth:** Admin

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `registration` | string | Yes | Aircraft registration (e.g. `ZS-XYZ`) |
| `type` | string | No | Aircraft type (e.g. `B777-300`) |
| `category` | string | No | Category (e.g. `Long Range`) |
| `hub` | string | No | Hub ICAO code |
| `hub_name` | string | No | Hub display name |
| `seats` | object | No | `{ economy, business, first }` |
| `range_km` | int | No | Maximum range in km |
| `cruise_speed_kmh` | int | No | Cruise speed in km/h |
| `status` | string | No | Default: `active` |
| `image` | string | No | Image URL or path |
| `description` | string | No | Description text |

**Response `201`** — Created [Aircraft](#aircraft) object.

---

#### `PUT /api/fleet/{id}`

Update an aircraft.

**Auth:** Admin

**Path parameters** — same as `GET /api/fleet/{id}`

**Request body** — Any subset of the fields from `POST /api/fleet`.

**Response `200`** — Updated [Aircraft](#aircraft) object.

**Errors**

| Code | Reason |
|---|---|
| `404` | Aircraft not found |

---

#### `DELETE /api/fleet/{id}`

Retire an aircraft (sets status to `retired`).

**Auth:** Admin

**Path parameters** — same as `GET /api/fleet/{id}`

**Response `200`**

```json
{ "message": "Aircraft retired" }
```

**Errors**

| Code | Reason |
|---|---|
| `404` | Aircraft not found |

---

### Bookings

#### `POST /api/bookings`

Create a new booking.

**Auth:** Optional (booking is linked to user if authenticated)

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `itinerary` | object | Yes | Itinerary with `segments` array |
| `cabinClass` | string | Yes | `economy`, `business`, or `first` |
| `passengers` | int | No | Number of passengers (default: 1) |
| `passengerDetails` | array | Yes | One object per passenger |
| `passengerDetails[].firstName` | string | Yes | |
| `passengerDetails[].lastName` | string | Yes | |
| `passengerDetails[].email` | string | Yes | |
| `passengerDetails[].phone` | string | No | |
| `passengerDetails[].nationality` | string | No | ISO country code |
| `passengerDetails[].seat` | string | No | Seat number (e.g. `12A`) |
| `seat` | string | No | Primary seat (single-passenger shorthand) |

**Response `201`** — [Booking](#booking) object.

**Booking reference format:** `AFV` + 6 random alphanumeric characters (ambiguous characters `0`, `O`, `I`, `L` excluded).

**Errors**

| Code | Reason |
|---|---|
| `400` | Missing required fields |
| `409` | Seat already taken |

---

#### `GET /api/bookings/my`

List all bookings belonging to the authenticated user.

**Auth:** Required

**Response `200`** — Array of [Booking](#booking) objects.

---

#### `GET /api/bookings/lookup`

Look up a booking without authentication (uses reference + email verification).

**Auth:** None

**Query parameters**

| Parameter | Type | Required |
|---|---|---|
| `ref` | string | Yes |
| `email` | string | Yes |

**Response `200`** — [Booking](#booking) object.

**Errors**

| Code | Reason |
|---|---|
| `400` | Missing `ref` or `email` |
| `404` | Booking not found |

---

#### `GET /api/bookings/{ref}`

Get a specific booking by reference.

**Auth:** Required (admin or booking owner)

**Path parameters**

| Parameter | Description |
|---|---|
| `ref` | Booking reference (e.g. `AFVABCDEF`) |

**Response `200`** — [Booking](#booking) object.

**Errors**

| Code | Reason |
|---|---|
| `403` | Not the booking owner and not an admin |
| `404` | Booking not found |

---

#### `PUT /api/bookings/{ref}/cancel`

Cancel a booking.

**Auth:** Required (admin or booking owner)

**Path parameters** — same as above.

**Response `200`** — Updated [Booking](#booking) with `status: "cancelled"`.

**Errors**

| Code | Reason |
|---|---|
| `400` | Booking already cancelled |
| `403` | Not the booking owner and not an admin |
| `404` | Booking not found |

---

### Admin

All `/api/admin/*` routes require **Admin** auth.

---

#### `GET /api/admin/stats`

Dashboard statistics.

**Response `200`**

```json
{
  "totalBookings": 100,
  "confirmedBookings": 95,
  "cancelledBookings": 5,
  "delayedBookings": 0,
  "todayBookings": 3,
  "totalRevenue": 50000.00,
  "totalUsers": 25,
  "activeFleet": 8,
  "revenueByClass": {
    "economy": 30000.00,
    "business": 15000.00,
    "first": 5000.00
  },
  "topRoutes": [
    { "route": "FQMA-FAOR", "count": 45 }
  ]
}
```

---

#### `GET /api/admin/users`

List all users.

**Response `200`** — Array of [User](#user) objects (passwords excluded).

---

#### `POST /api/admin/users`

Create a user account. **Primary admin only.**

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | |
| `email` | string | Yes | |
| `password` | string | Yes | |
| `role` | string | No | `admin` or `user` (default: `user`) |
| `vatsimCid` | string | No | |

**Response `201`** — Created [User](#user) object.

**Errors**

| Code | Reason |
|---|---|
| `403` | Not the primary admin |
| `409` | Email already registered |

---

#### `PUT /api/admin/users/{id}/role`

Change a user's role. **Primary admin only.**

**Path parameters**

| Parameter | Description |
|---|---|
| `id` | User ID |

**Request body**

| Field | Type | Values |
|---|---|---|
| `role` | string | `admin`, `user` |

**Response `200`** — Updated [User](#user) object.

**Errors**

| Code | Reason |
|---|---|
| `400` | Cannot change primary admin's own role |
| `403` | Not the primary admin |
| `404` | User not found |

---

#### `GET /api/admin/bookings`

List all bookings.

**Response `200`** — Array of [Booking](#booking) objects.

---

#### `PUT /api/admin/bookings/{ref}/status`

Update a booking's status.

**Path parameters**

| Parameter | Description |
|---|---|
| `ref` | Booking reference |

**Request body**

| Field | Type | Values |
|---|---|---|
| `status` | string | `confirmed`, `on_time`, `delayed`, `cancelled` |

**Response `200`** — Updated [Booking](#booking) object.

**Errors**

| Code | Reason |
|---|---|
| `400` | Invalid status value |
| `404` | Booking not found |

---

#### `GET /api/admin/fleet`

List all aircraft (including retired).

**Response `200`** — Array of [Aircraft](#aircraft) objects.

---

#### `GET /api/admin/lookups`

Get reference data for populating admin forms.

**Response `200`**

```json
{
  "airports": [ ...Airport ],
  "aircraft": [ ...Aircraft ],
  "routeStatuses": ["active", "inactive"]
}
```

---

#### `GET /api/admin/routes`

List all routes with full details.

**Response `200`**

```json
{
  "summary": {
    "totalRoutes": 50,
    "activeRoutes": 48,
    "inactiveRoutes": 2,
    "routesWithAircraft": 45,
    "hubs": 2
  },
  "routes": [ ...Route ]
}
```

---

#### `POST /api/admin/routes`

Create a new route with schedules.

**Request body**

| Field | Type | Required | Description |
|---|---|---|---|
| `fromAirport` | string | Yes | ICAO code |
| `toAirport` | string | Yes | ICAO code |
| `hubAirport` | string | Yes | ICAO code |
| `aircraftId` | int | No | Assigned aircraft ID |
| `status` | string | No | `active` (default) or `inactive` |
| `schedules` | array | No | Array of schedule objects |
| `schedules[].flightNumber` | string | Yes | e.g. `AFV101` |
| `schedules[].slotCode` | string | Yes | e.g. `morning` |
| `schedules[].departureTime` | string | Yes | `HH:MM:SS` |
| `schedules[].active` | bool | No | Default: `true` |

**Response `201`** — Created [Route](#route) object with schedules.

---

#### `PUT /api/admin/routes/{id}`

Update a route and its schedules.

**Path parameters**

| Parameter | Description |
|---|---|
| `id` | Route ID |

**Request body** — Same structure as `POST /api/admin/routes`.

**Response `200`** — Updated [Route](#route) object.

---

#### `GET /api/admin/airline-stats`

Get airline-level statistics and profile.

**Response `200`** — [AirlineStats](#airlinestats) object.

---

#### `PUT /api/admin/airline-stats`

Update airline statistics (partial update).

**Request body**

| Field | Type |
|---|---|
| `totalFlights` | int |
| `totalHours` | int |
| `activeMembers` | int |
| `foundedDate` | string (`YYYY-MM-DD`) |
| `division` | string |
| `callsignPrefix` | string |

**Response `200`** — Updated [AirlineStats](#airlinestats) object.

---

### VATSIM

#### `GET /api/vatsim/online`

Get AFV pilots currently online on the VATSIM network.

**Auth:** None

**Response `200`**

```json
{
  "source": "live",
  "onlinePilots": [
    {
      "callsign": "AFV101",
      "name": "John Pilot",
      "cid": "123456",
      "from": "FQMA",
      "to": "FAOR",
      "aircraft": "B777",
      "altitude": 35000,
      "groundspeed": 470,
      "lat": -23.5,
      "lon": 25.5,
      "heading": 180,
      "logonTime": "2024-01-01T10:00:00Z",
      "fromCoords": [-23.5, 25.5],
      "toCoords": [-25.0, 28.0],
      "timing": {
        "scheduledDep": "2024-01-01T08:00:00Z",
        "scheduledArr": "2024-01-01T14:00:00Z",
        "scheduledDepStr": "08:00",
        "scheduledArrStr": "14:00",
        "eta": "2024-01-01T14:30:00Z",
        "etaStr": "14:30",
        "depDelayMin": 15,
        "arrDelayMin": 25,
        "distanceRemainingKm": 500,
        "distanceTotalKm": 2000,
        "progress": 75
      },
      "destinationWeather": {
        "temp": 25,
        "wind": "12 kt W",
        "conditions": "Mostly cloudy",
        "visText": null
      }
    }
  ],
  "count": 1,
  "updatedAt": "2024-01-01T12:30:00Z"
}
```

**Notes**
- Pilot position data is fetched **client-side** by the browser directly from `https://data.vatsim.net/v3/vatsim-data.json`. This endpoint provides the same data server-side (with METAR enrichment) but the frontend no longer proxies pilot data through PHP.
- Server-side cache: 60 seconds for pilot data, 10 minutes per METAR.
- Flight timing (ETA, delay badges, progress bar) is computed in the browser using the same algorithm as the PHP backend.
- `destinationWeather` is `null` when the browser fetches directly; it is populated only when the PHP endpoint is called explicitly.
- On Windows, `backend-php/cacert.pem` (included in the repo) is required for the PHP server to make outbound HTTPS requests. See the [Setup Guide](../docs/setup/README.md#certificados-ssl-ca-bundle).

---

#### `GET /api/vatsim/stats`

Get airline profile and stats (same data as `GET /api/admin/airline-stats`).

**Auth:** None

**Response `200`** — [AirlineStats](#airlinestats) object.

---

## Data Models

### User

```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "vatsimCid": "123456",
  "role": "admin",
  "isPrimaryAdmin": false,
  "createdByUserId": null,
  "createdByName": null,
  "joinedAt": "2020-03-01 00:00:00",
  "flightHours": 120,
  "points": 3400
}
```

---

### Airport

```json
{
  "icao": "FQMA",
  "iata": "MPM",
  "name": "Maputo International",
  "city": "Maputo",
  "country": "Mozambique",
  "lat": -23.8614,
  "lon": 35.3194,
  "hub": true
}
```

---

### Aircraft

```json
{
  "id": 1,
  "registration": "ZS-XYZ",
  "type": "B777-300",
  "category": "Long Range",
  "hub": "FQMA",
  "hub_name": "Maputo International",
  "seats": {
    "economy": 300,
    "business": 50,
    "first": 10
  },
  "range_km": 13650,
  "cruise_speed_kmh": 490,
  "status": "active",
  "image": "/assets/aircraft/b777.jpg",
  "description": "Long-range wide-body aircraft."
}
```

---

### Segment

```json
{
  "routeId": 1,
  "flightNumber": "AFV101",
  "from": "FQMA",
  "to": "FAOR",
  "departureDate": "2024-06-15",
  "arrivalDate": "2024-06-15",
  "departure": "08:00",
  "arrival": "14:00",
  "departureDateTime": "2024-06-15T08:00:00Z",
  "arrivalDateTime": "2024-06-15T14:00:00Z",
  "durationMinutes": 360,
  "duration": "6h 00m",
  "distanceKm": 2000,
  "aircraft": {
    "id": 1,
    "registration": "ZS-XYZ",
    "type": "B777-300"
  }
}
```

---

### Booking

```json
{
  "id": 1,
  "bookingRef": "AFVABCDEF",
  "userId": 5,
  "userName": "John Doe",
  "passengerEmail": "john@example.com",
  "flightNumber": "AFV101 / AFV205",
  "from": "FQMA",
  "to": "FAOR",
  "date": "2024-06-15",
  "cabinClass": "economy",
  "passengers": 2,
  "totalPrice": 4500.50,
  "status": "confirmed",
  "seat": "12A",
  "passengerDetails": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "+27123456789",
      "nationality": "ZA",
      "seat": "12A"
    }
  ],
  "itinerary": {
    "segments": [ ...Segment ]
  },
  "createdAt": "2024-06-01T10:00:00Z",
  "updatedAt": "2024-06-01T10:00:00Z",
  "cancelledAt": null
}
```

**Booking status values:** `confirmed`, `on_time`, `delayed`, `cancelled`

---

### Route

```json
{
  "id": 1,
  "fromAirport": "FQMA",
  "toAirport": "FAOR",
  "hubAirport": "FQMA",
  "distanceKm": 2000,
  "durationMinutes": 360,
  "status": "active",
  "aircraftId": 1,
  "aircraft": { ...Aircraft },
  "fromAirportDetails": { ...Airport },
  "toAirportDetails": { ...Airport },
  "hubAirportDetails": { ...Airport },
  "schedules": [
    {
      "id": 1,
      "flightNumber": "AFV101",
      "slotCode": "morning",
      "departureTime": "07:00:00",
      "active": true
    }
  ]
}
```

---

### AirlineStats

```json
{
  "totalFlights": 4287,
  "totalHours": 12950,
  "activeMembers": 63,
  "foundedDate": "2020-03-01",
  "firstFlight": {
    "from": "FQMA",
    "to": "FQNC",
    "date": "2020-03-01"
  },
  "division": "VATSIM Sub-Saharan Africa (VATSSA)",
  "callsignPrefix": "AFV",
  "updatedAt": "2024-06-15T00:00:00Z"
}
```

---

## Pricing Logic

### Price formula

```
perPerson = round(
  baseFare
  × (0.70 + 0.30 × fuelMultiplier)
  × cabinClassMultiplier
  × seasonalMultiplier
  × demandMultiplier
  + 45   ← taxes & fees (USD)
)
```

### Base fare

`$0.065 per km`, tapered for long-haul routes.

### Cabin class multipliers

| Cabin | Multiplier |
|---|---|
| Economy | 1.0× |
| Business | 3.2× |
| First | 6.5× |

### Demand multipliers (load factor)

| Load factor | Multiplier |
|---|---|
| ≥ 90% | 1.45× |
| 75–89% | 1.20× |
| 50–74% | 1.00× |
| 25–49% | 0.85× |
| < 25% | 0.70× |

### Fuel multiplier (oil price)

```
fuelMultiplier = clamp(0.70 + 0.30 × (oilPrice / 80), 0.70, 1.50)
```

Source: Alpha Vantage (Brent crude), cached 24 hours.

### Seasonal multipliers

Region-specific multipliers apply per month (e.g. Africa peaks in June–August and December).  
Labels: `peak`, `high`, `shoulder`, `low`.

---

## Endpoint Summary

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | None | Health check |
| `POST` | `/api/auth/register` | None | Register user |
| `POST` | `/api/auth/login` | None | Login |
| `GET` | `/api/auth/me` | Required | Current user |
| `GET` | `/api/flights/search` | None | Search itineraries |
| `GET` | `/api/flights/routes` | None | List routes |
| `GET` | `/api/flights/airports` | None | List airports |
| `POST` | `/api/flights/itinerary` | None | Hydrate itinerary |
| `POST` | `/api/flights/seat-map` | None | Occupied seats |
| `GET` | `/api/flights/pricing-factors` | None | Pricing multipliers |
| `GET` | `/api/fleet` | None | List fleet |
| `GET` | `/api/fleet/{id}` | None | Get aircraft |
| `POST` | `/api/fleet` | Admin | Create aircraft |
| `PUT` | `/api/fleet/{id}` | Admin | Update aircraft |
| `DELETE` | `/api/fleet/{id}` | Admin | Retire aircraft |
| `POST` | `/api/bookings` | Optional | Create booking |
| `GET` | `/api/bookings/my` | Required | My bookings |
| `GET` | `/api/bookings/lookup` | None | Lookup by ref + email |
| `GET` | `/api/bookings/{ref}` | Required | Get booking |
| `PUT` | `/api/bookings/{ref}/cancel` | Required | Cancel booking |
| `GET` | `/api/admin/stats` | Admin | Dashboard stats |
| `GET` | `/api/admin/users` | Admin | List users |
| `POST` | `/api/admin/users` | Primary admin | Create user |
| `PUT` | `/api/admin/users/{id}/role` | Primary admin | Change role |
| `GET` | `/api/admin/bookings` | Admin | All bookings |
| `PUT` | `/api/admin/bookings/{ref}/status` | Admin | Update status |
| `GET` | `/api/admin/fleet` | Admin | All aircraft |
| `GET` | `/api/admin/lookups` | Admin | Reference data |
| `GET` | `/api/admin/routes` | Admin | All routes |
| `POST` | `/api/admin/routes` | Admin | Create route |
| `PUT` | `/api/admin/routes/{id}` | Admin | Update route |
| `GET` | `/api/admin/airline-stats` | Admin | Airline stats |
| `PUT` | `/api/admin/airline-stats` | Admin | Update airline stats |
| `GET` | `/api/vatsim/online` | None | Online pilots |
| `GET` | `/api/vatsim/stats` | None | Airline stats (public) |

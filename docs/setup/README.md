# Setup Guide

## Overview

The runnable application is `apps/api`. It serves:

- The REST API under `/api/*`
- The static website from `apps/web`

The backend expects a MySQL database and a repository-level `.env` file.

## Requirements

- Node.js 18+
- npm
- MySQL 8+ or a compatible server

## Environment Setup

Copy the template:

```bash
cp .env.example .env
```

Then configure the following values:

| Variable | Required | Purpose |
| --- | --- | --- |
| `JWT_SECRET` | Yes | Signs JWT access tokens |
| `DB_HOST` | Yes | Database hostname or IP |
| `DB_PORT` | Yes | Database port |
| `DB_USER` | Yes | Database username |
| `DB_PASSWORD` | No | Database password |
| `DB_NAME` | Yes | Database name to create/use |
| `PORT` | No | HTTP port for the server |
| `NODE_ENV` | No | Runtime environment |

Optional primary admin bootstrap:

| Variable | Required | Purpose |
| --- | --- | --- |
| `PRIMARY_ADMIN_NAME` | No | Display name of the main admin |
| `PRIMARY_ADMIN_EMAIL` | Recommended | Email used to find or create the main admin |
| `PRIMARY_ADMIN_PASSWORD` | Recommended | Plain password or bcrypt hash |
| `PRIMARY_ADMIN_VATSIM_CID` | No | Optional VATSIM CID |
| `PRIMARY_ADMIN_FLIGHT_HOURS` | No | Initial flight hours |
| `PRIMARY_ADMIN_POINTS` | No | Initial points |

Optional pricing data:

| Variable | Required | Purpose |
| --- | --- | --- |
| `ALPHA_VANTAGE_KEY` | No | Fetches Brent crude data for pricing adjustments |

## Installation

From the repository root:

```bash
npm run install:api
```

If you prefer to work directly inside the API app:

```bash
cd apps/api
npm install
```

## Running the Project

From the repository root:

```bash
npm start
```

For development:

```bash
npm run dev
```

The default URL is `http://localhost:3000`.

## What Happens on Startup

The API startup flow is implemented in [`apps/api/src/server.js`](D:/Escola/projetos-do-git/IADE_AFVsite-master/apps/api/src/server.js) and [`apps/api/src/repositories/database.js`](D:/Escola/projetos-do-git/IADE_AFVsite-master/apps/api/src/repositories/database.js).

On startup, the application:

1. Loads `.env` from the repository root.
2. Connects to MySQL and creates the configured database if needed.
3. Runs the SQL schema from [`database/schema/mysql.sql`](D:/Escola/projetos-do-git/IADE_AFVsite-master/database/schema/mysql.sql).
4. Applies code-level compatibility checks for some columns and indexes.
5. Seeds airports, aircraft, route schedules, and airline stats if the database is empty.
6. Creates or updates the primary admin account if bootstrap variables are present.
7. Starts the HTTP server and serves `apps/web`.

## First Admin Access

There is no hard-coded default admin account in the current implementation.

To guarantee admin access on a fresh environment, set:

- `PRIMARY_ADMIN_EMAIL`
- `PRIMARY_ADMIN_PASSWORD`

At startup, the app will either:

- create that user as the primary admin, or
- update the existing matching user and elevate it to primary admin

## Troubleshooting

### Server exits during startup

Check:

- MySQL is running
- The `.env` database credentials are correct
- The configured user has permission to create or access the target database

### Website loads but API calls fail

Check:

- The backend started without database errors
- `http://localhost:3000/api/health` returns a valid JSON response

### No admin account exists

Set `PRIMARY_ADMIN_EMAIL` and `PRIMARY_ADMIN_PASSWORD`, then restart the server.

## Current Limitations

- `apps/admin` is not yet a standalone runnable app.
- Root-level `tests/` folders are placeholders.
- `database/migrations` and `database/seeds` are reserved for future expansion and are not yet part of the runtime flow.

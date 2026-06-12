# Kinetic Feature Management

Feature flags & config management service for personal apps, deployed at
[features.sloboda.fr](https://features.sloboda.fr).

## Stack

- **Backend**: NestJS + TypeORM + SQLite (better-sqlite3), clean architecture (domain / application / infrastructure / interfaces)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS, clean architecture (domain / application / infrastructure / presentation)
- **Monorepo**: npm workspaces (`backend`, `frontend`)
- **Docker**: single image, the Nest backend serves the built React app as static assets

## Architecture

```
backend/src/
  domain/          # Entities, value objects, repository ports (no framework deps)
  application/      # Use-cases orchestrating domain objects
  infrastructure/    # TypeORM entities/repositories, SQLite config
  interfaces/http/   # Controllers, DTOs, Nest modules

frontend/src/
  domain/          # Types and formatting
  application/      # Hooks orchestrating data fetching (use-cases)
  infrastructure/    # API client
  presentation/      # React components and pages
```

## Authentication

Authentication is delegated to the central [auth.sloboda.fr](https://auth.sloboda.fr) service via the
OAuth2 Authorization Code flow:

- `GET /api/auth/login` redirects to `auth.sloboda.fr/authorize`.
- `GET /api/auth/callback` exchanges the code for a token pair (`/token`), fetches the profile
  (`/userinfo`) and upserts the local user mirror (`id`/`email`/`name`/`avatarUrl`).
- The session is stored in two httpOnly cookies: `access_token` (short-lived, issued by
  auth-service) and `refresh_token` (~30 days). `JwtAuthGuard` verifies the access token via JWKS
  (`/.well-known/jwks.json`) and silently refreshes if needed.
- `POST /api/auth/logout` only clears the local cookies (no global logout).
- `POST /api/auth/disconnect?secret=AUTH_WEBHOOK_SECRET` is the `logoutWebhookUrl` registered with
  auth-service (`{ "userId": "..." }`): called on global logout, it marks the user as revoked
  (current timestamp); any access token issued before that instant is then rejected by
  `JwtAuthGuard`.

This is the same auth integration pattern as the sibling app
[home-budget](https://github.com/SlobodaFR/home-budget) — see its README for more details.

## Environment variables (backend)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `AUTH_SERVICE_URL` | yes | - | Base URL of the central auth service (`https://auth.sloboda.fr`). |
| `AUTH_CLIENT_ID` | yes | - | OAuth2 client id registered with auth-service. |
| `AUTH_CLIENT_SECRET` | yes | - | Corresponding OAuth2 client secret. |
| `AUTH_WEBHOOK_SECRET` | yes | - | Shared secret for the `POST /api/auth/disconnect` webhook. |
| `FRONTEND_URL` | no | `http://localhost:3002` | Frontend base URL, used for the OAuth2 `redirect_uri` and CORS config. |
| `DATABASE_PATH` | no | - | Path to the SQLite file. |
| `NODE_ENV` | no | - | `production` enables the `secure` flag on session cookies. |
| `PORT` | no | `3002` | Port the server listens on. |
| `MINIO_ENDPOINT` | no | - | MinIO (S3-compatible) server URL. |
| `MINIO_BUCKET` | no | - | Destination bucket. If set, enables Litestream replication of the SQLite DB. |
| `MINIO_REPLICA_PATH` | no | `home-features` | Replication path prefix in the bucket. |
| `MINIO_REGION` | no | `us-east-1` | S3 region (required by the SDK, irrelevant for MinIO). |
| `MINIO_ACCESS_KEY_ID` | no | - | MinIO access key. |
| `MINIO_SECRET_ACCESS_KEY` | no | - | MinIO secret key. |

Copy `backend/.env.example` to `backend/.env` and fill in the values. This file is read
automatically by `ConfigModule` in dev, and can also be passed to `docker run --env-file`.

## Development

```bash
npm install
cp backend/.env.example backend/.env   # then edit AUTH_CLIENT_SECRET etc.
npm run dev:backend    # Nest on :3002
npm run dev:frontend   # Vite on :5173, proxies /api to :3002
```

## Tests

```bash
npm test               # backend (jest) + frontend (vitest)
```

## Build & run with Docker

```bash
docker build -t kinetic-feature-management .
docker run -p 3002:3000 \
  -v home-features-data:/app/backend/data \
  --env-file backend/.env \
  kinetic-feature-management
```

The app is served entirely on port 3000 inside the container (API under `/api`, React app on `/`).

### SQLite replication to MinIO (Litestream)

If `MINIO_BUCKET` is set, the entrypoint restores the DB from the MinIO replica at startup
(if the local file is absent), then runs the server under `litestream replicate`, continuously
streaming the WAL to the bucket. Without `MINIO_BUCKET`, the container starts normally, with no
replication.

## Domain model

The feature flags / apps / environments / config domain model is not implemented yet — this is a
scaffold providing the shared infrastructure (auth, persistence, build/deploy plumbing) only. See
`CLAUDE.md` for follow-up work.

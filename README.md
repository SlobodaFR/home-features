# Kinetic Feature Management

Feature flags & config management service for personal apps, deployed at
[features.sloboda.fr](https://features.sloboda.fr). The other `home-*` services read their flags
through [OpenFeature](https://openfeature.dev) and the OFREP protocol
([`docs/ofrep.md`](docs/ofrep.md)).

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

| Variable                  | Required | Default                    | Description                                                                                                                                                                    |
| ------------------------- | -------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AUTH_SERVICE_URL`        | yes      | -                          | Base URL of the central auth service (`https://auth.sloboda.fr`).                                                                                                              |
| `AUTH_CLIENT_ID`          | yes      | -                          | OAuth2 client id registered with auth-service.                                                                                                                                 |
| `AUTH_CLIENT_SECRET`      | yes      | -                          | Corresponding OAuth2 client secret.                                                                                                                                            |
| `AUTH_WEBHOOK_SECRET`     | yes      | -                          | Shared secret for the `POST /api/auth/disconnect` webhook.                                                                                                                     |
| `FRONTEND_URL`            | prod     | -                          | Public base URL (`https://` in production): OAuth2 `redirect_uri` and the only trusted `Origin` for mutations (CSRF guard). No CORS: the SPA is served by this service.        |
| `PSEUDONYM_SECRET`        | prod     | dev value                  | Random secret (>= 32 bytes) used to pseudonymize user ids in logs (HMAC). Refused if missing or weak in production.                                                            |
| `DATABASE_PATH`           | no       | `data/features.sqlite`     | Path to the SQLite file. Must not be empty.                                                                                                                                    |
| `TRUST_PROXY_HOPS`        | no       | `0`                        | Reverse-proxy hops to trust for `X-Forwarded-For` (`1` behind Caddy, set by the deploy workflow).                                                                              |
| `NODE_ENV`                | no       | -                          | `production` enables the `secure` flag on session cookies.                                                                                                                     |
| `PORT`                    | no       | `3002`                     | Port the server listens on.                                                                                                                                                    |
| `POSTHOG_API_KEY`         | no       | -                          | PostHog project key for the operational telemetry (`runtime_health` every 60 s, `http_request` per admin/UI route). Absent: telemetry is a no-op, startup never depends on it. |
| `POSTHOG_HOST`            | no       | `https://eu.i.posthog.com` | PostHog ingestion host.                                                                                                                                                        |
| `MINIO_ENDPOINT`          | no       | -                          | MinIO (S3-compatible) server URL.                                                                                                                                              |
| `MINIO_BUCKET`            | no       | -                          | Destination bucket. If set, enables Litestream replication of the SQLite DB.                                                                                                   |
| `MINIO_REPLICA_PATH`      | no       | `home-features`            | Replication path prefix in the bucket.                                                                                                                                         |
| `MINIO_REGION`            | no       | `us-east-1`                | S3 region (required by the SDK, irrelevant for MinIO).                                                                                                                         |
| `MINIO_ACCESS_KEY_ID`     | no       | -                          | MinIO access key.                                                                                                                                                              |
| `MINIO_SECRET_ACCESS_KEY` | no       | -                          | MinIO secret key.                                                                                                                                                              |

Copy `backend/.env.example` to `backend/.env` and fill in the values. This file is read
automatically by `ConfigModule` in dev, and can also be passed to `docker run --env-file`.

## Health check

`GET /healthz` (outside the `api` prefix, no session) returns `{ "status": "ok", "runtime": ... }` with
event-loop and memory samples. It is internal: Caddy answers 404 for `/healthz*`, the Docker
`HEALTHCHECK` calls it inside the container, and on the VPS use `curl 127.0.0.1:3002/healthz`.

## Development

```bash
npm install
cp backend/.env.example backend/.env   # then edit AUTH_CLIENT_SECRET etc.
npm run dev:backend    # tsc once, then node --watch on dist (re-run after editing sources), :3002
npm run dev:frontend   # Vite on :5173, proxies /api to :3002
```

## Tests

```bash
npm test               # backend + frontend (vitest)
npm run lint           # Oxlint (type-aware)
npm run format:check   # Oxfmt (npm run format to write)
npm run typecheck      # tsc backend + frontend
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

Apps own Environments, FeatureFlags (with per-environment on/off values, an immutable key, a
client-exposed switch and a last-evaluation time), ConfigEntries (with per-environment typed
values: `STRING`/`NUMBER`/`BOOLEAN`/`JSON`) and ApiKeys (bound to one environment and a scope).
Every flag value change is appended to `flag_value_changes`. Management is done through an
authenticated (OAuth2 session) REST API consumed by the React UI.

## Flag evaluation for other services (OFREP)

home-features is an OpenFeature provider through the OpenFeature Remote Evaluation Protocol 0.4.0
(boolean flags): `POST /api/ofrep/v1/evaluate/flags/{key}` and `POST /api/ofrep/v1/evaluate/flags`
(bulk, strong `ETag`, `304`). Authentication by an API key created in the UI for one app, one
environment and a scope (`server` for backends, `web` for a browser-facing proxy, which only sees
the flags marked client-exposed). Rate limited per key (300/min) and per IP for failed
authentications (20/min). Full contract: [`docs/ofrep.md`](docs/ofrep.md).

### Integrating a consumer (home-* backend)

Do not write an HTTP client: use the official SDK and provider (`@openfeature/server-sdk` +
`@openfeature/ofrep-provider`, not `@openfeature/nestjs-sdk`) behind a `FeatureFlags` port, as
the reference adapter in home-auth does
([SlobodaFR/home-auth#86](https://github.com/SlobodaFR/home-auth/pull/86),
`backend/src/infrastructure/feature-flags/` and `backend/src/domain/shared/feature-flags.ts`):

- `FeatureFlags.isEnabled(key, codeDefault)`; the code default is the current production
  behaviour (off for anything new). For security « enforce » flags, the code default flips to on
  in the release that follows their stabilisation in production; once a flag is no longer
  needed, remove the code, then delete the flag here.
- `OpenFeature.setProvider` (never `setProviderAndWait`: startup never waits for home-features),
  `timeoutMs: 500`, `Authorization: Bearer` header from the configuration. `OFREP_ENDPOINT` and
  `OFREP_HEADERS` (the provider also reads `OFREP_TIMEOUT_MS`) must be refused or ignored at
  startup.
- Optional `FEATURES_OFREP_URL` (`https://features.sloboda.fr/api`, https in production) and
  `FEATURES_API_KEY` (`^hf_[0-9a-f]{64}$`, a `server` key bound to the right environment): absent
  → no-op provider and one warning; the service still starts.
- Per-key memo of 30 s; on errors other than `FLAG_NOT_FOUND`, the last known value (process
  local) else the code default, with a throttled warning;
  `FEATURES_PIN_<FLAG_KEY_IN_UPPER_SNAKE_CASE>=true|false` overrides everything in an emergency
  (flag `new-ui` → `FEATURES_PIN_NEW_UI=false`). `OpenFeature.close()` on shutdown.
- A front end goes through a same-origin proxy in its own backend, with a `web` key; flags a
  browser may see are marked client-exposed here, never filtered by the consumer.

### home-features as its own consumer

home-features does not drive itself: it has neither `FEATURES_OFREP_URL` nor `FEATURES_API_KEY`
(and the deploy workflow does not pass any), so its copy of the reference adapter
(`backend/src/infrastructure/feature-flags/`, byte-identical to home-auth's) runs as a **no-op**:
only the emergency pins `FEATURES_PIN_<FLAG_KEY_IN_UPPER_SNAKE_CASE>=true|false` and the code
defaults apply (e.g. `FEATURES_PIN_AUTH_VERIFY_TOKEN_CLAIMS=true`). A pin needs a container restart.

### Emergency switch

Without the UI or home-auth, on the VPS:
`docker compose exec features node dist/cli/set-flag.js --app <slug> --env <slug> --flag <key> --enabled true|false [--actor <name>]`
(journaled like a UI change). See [`docs/cli.md`](docs/cli.md).

## Public exposure API (configs, legacy flags)

`GET /api/v1/flags-and-configs?environment=<slug>` returns an app's flags and config values for
the environment the API key is bound to (the `environment` parameter must name it, `400`
otherwise). Prefer OFREP for flags. See [`docs/public-api.md`](docs/public-api.md), which also
describes the flag lifecycle (immutable keys, confirmed deletion of a flag that is on, the
append-only change journal) and the rate limits.

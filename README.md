# Features

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
- `POST /api/auth/disconnect` is the `logoutWebhookUrl` registered with auth-service
  (`{ "userId": "..." }`): called on global logout, it marks the user as revoked (current
  timestamp); any access token issued before that instant is then rejected by `JwtAuthGuard`. It is
  authenticated by home-auth's **signature** (contract PC7, below) or, during the transition, by the
  legacy `?secret=AUTH_WEBHOOK_SECRET`.

### Signed logout webhook (double acceptance)

Headers sent by home-auth: `X-Auth-Webhook-Id` (uuid v4), `X-Auth-Webhook-Timestamp` (unix seconds),
`X-Auth-Webhook-Signature: v1=<hex>[,v1=<hex>]` with
`hex = HMAC-SHA256(secret, id + "." + timestamp + "." + rawBody)`; the key is the secret string
(64 hex characters, UTF-8, not its decoded bytes) and `rawBody` the bytes received.

Verification (`backend/src/domain/auth/webhook-signature.ts`):

1. `|now - timestamp| <= 120 s`;
2. each `v1=` entry is decoded (hex, 32 bytes; any invalid format: 401) and compared with the
   recomputed HMAC by `timingSafeEqual`; one matching entry is enough (two entries during the 24 h
   overlap after the secret is regenerated);
3. an accepted `id` is refused if it comes back within 10 minutes (process memory: a restart
   forgets it; only an `id` with a valid signature is remembered). Replay is **strict**: as soon as
   an `X-Auth-Webhook-*` header is present and the `id` was already seen, the request is refused
   (401) even with a valid `?secret=`.

`rawBody`: `main.ts` creates the application with `rawBody: true` (`nestApplicationOptions`, shared
with the HTTP tests); `req.rawBody` holds the exact bytes of the JSON body.

Double acceptance (`AuthenticateLogoutWebhookUseCase`):

- no signature header (`X-Auth-Webhook-Id`, `-Timestamp` and `-Signature` all empty): legacy
  `?secret=` compared with `timingSafeEqual`, while the flag `auth-webhook-require-signature` is
  `false`;
- headers present and valid signature: accepted; `id` already seen: refused (401), with no fallback
  to `?secret=`;
- headers present but signature invalid (format, window, hmac) or not checkable (no
  `AUTH_WEBHOOK_SIGNING_SECRET`, raw body unavailable): fallback to the legacy `?secret=` (flag
  `false`);
- flag `true`: the signature is mandatory and `?secret=` is no longer accepted; without a configured
  `AUTH_WEBHOOK_SIGNING_SECRET` nothing is accepted (fail closed: do not turn the flag on before the
  secret is in place).

Acceptances are logged (never the secret, the signature or the `id`), one line per reason every
5 minutes: INFO `signature`; WARN `legacy ?secret=` with the reason among `no-signature-headers`,
`missing-signing-secret`, `format`, `window`, `hmac`, `raw-body-unavailable`. This lets you check the
switch before turning the flag on (no more WARN = flag can be turned on).

`AUTH_WEBHOOK_SIGNING_SECRET` (optional, exactly 64 **lowercase** hex characters, 1Password
`FEATURES_AUTH_WEBHOOK_SIGNING_SECRET`) is the secret shown once by home-auth's admin
("Regenerate"). Absent or empty: only the legacy path exists. Uppercase, whitespace or wrong length:
the service refuses to start (in every environment).
home-features reads this flag through its no-op adapter: only a pin
(`FEATURES_PIN_AUTH_WEBHOOK_REQUIRE_SIGNATURE=true`) or a new code default turns it on.

Fixed test vectors of the contract (published by home-auth, copied into
`backend/src/domain/auth/webhook-signature.spec.ts`):

|     | secret | id                                     | timestamp    | body                  | HMAC (hex)                                                         |
| --- | ------ | -------------------------------------- | ------------ | --------------------- | ------------------------------------------------------------------ |
| 1   | `S1`   | `3b241101-e2bb-4255-8caf-4136c566a962` | `1700000000` | `{"userId":"u1"}`     | `41294c53497c1d18871786b2d5c3ec091e6b357638e7104d826de50af8813242` |
| 2   | `S2`   | `3b241101-e2bb-4255-8caf-4136c566a962` | `1700000000` | `{"userId":"u1"}`     | `89de6c4652b33d864427b3091771ed8b9266a99b3bf915b126eb4655a2dce09f` |
| 3   | `S1`   | `9b2f0f6e-8d3a-4f6b-9c1e-2a7d5e4c1b30` | `1700000123` | `{"userId":"4b8f-é"}` | `d9a2c8cec34058ebb100f8b454ba46b1214cf777000d9aab00dda91205d5a3ac` |

- `S1` = `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f`
- `S2` = `ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100`
- Cross-check: `printf '%s' '3b241101-e2bb-4255-8caf-4136c566a962.1700000000.{"userId":"u1"}' | openssl dgst -sha256 -hmac <S1>`

This is the same auth integration pattern as the sibling app
[home-budget](https://github.com/SlobodaFR/home-budget) — see its README for more details.

## Environment variables (backend)

| Variable                      | Required | Default                    | Description                                                                                                                                                                                               |
| ----------------------------- | -------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SERVICE_URL`            | yes      | -                          | Base URL of the central auth service (`https://auth.sloboda.fr`).                                                                                                                                         |
| `AUTH_CLIENT_ID`              | yes      | -                          | OAuth2 client id registered with auth-service.                                                                                                                                                            |
| `AUTH_CLIENT_SECRET`          | yes      | -                          | Corresponding OAuth2 client secret.                                                                                                                                                                       |
| `AUTH_WEBHOOK_SECRET`         | yes      | -                          | Shared secret for the `POST /api/auth/disconnect` webhook.                                                                                                                                                |
| `AUTH_WEBHOOK_SIGNING_SECRET` | no       | -                          | Signing secret of the logout webhook (64 lowercase hex characters, shown once by home-auth's admin). Absent: only the legacy `?secret=` authenticates. 1Password: `FEATURES_AUTH_WEBHOOK_SIGNING_SECRET`. |
| `FRONTEND_URL`                | prod     | -                          | Public base URL (`https://` in production): OAuth2 `redirect_uri` and the only trusted `Origin` for mutations (CSRF guard). No CORS: the SPA is served by this service.                                   |
| `PSEUDONYM_SECRET`            | prod     | dev value                  | Random secret (>= 32 bytes) used to pseudonymize user ids in logs (HMAC). Refused if missing or weak in production.                                                                                       |
| `DATABASE_PATH`               | no       | `data/features.sqlite`     | Path to the SQLite file. Must not be empty.                                                                                                                                                               |
| `TRUST_PROXY_HOPS`            | no       | `0`                        | Reverse-proxy hops to trust for `X-Forwarded-For` (`1` behind Caddy, set by the deploy workflow).                                                                                                         |
| `NODE_ENV`                    | no       | -                          | `production` enables the `secure` flag on session cookies.                                                                                                                                                |
| `PORT`                        | no       | `3002`                     | Port the server listens on.                                                                                                                                                                               |
| `POSTHOG_API_KEY`             | no       | -                          | PostHog project key for the operational telemetry (`runtime_health` every 60 s, `http_request` per admin/UI route). Absent: telemetry is a no-op, startup never depends on it.                            |
| `POSTHOG_HOST`                | no       | `https://eu.i.posthog.com` | PostHog ingestion host.                                                                                                                                                                                   |
| `MINIO_ENDPOINT`              | no       | -                          | MinIO (S3-compatible) server URL.                                                                                                                                                                         |
| `MINIO_BUCKET`                | no       | -                          | Destination bucket. If set, enables Litestream replication of the SQLite DB.                                                                                                                              |
| `MINIO_REPLICA_PATH`          | no       | `home-features`            | Replication path prefix in the bucket.                                                                                                                                                                    |
| `MINIO_REGION`                | no       | `us-east-1`                | S3 region (required by the SDK, irrelevant for MinIO).                                                                                                                                                    |
| `MINIO_ACCESS_KEY_ID`         | no       | -                          | MinIO access key.                                                                                                                                                                                         |
| `MINIO_SECRET_ACCESS_KEY`     | no       | -                          | MinIO secret key.                                                                                                                                                                                         |

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

Flags read by home-features itself (all default to `false` in the code):

| Key                              | Effect                                                                                                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-verify-token-claims`       | `true`: `JwksAccessTokenVerifier` also verifies the audience (`AUTH_CLIENT_ID`), the issuer (origin of `AUTH_SERVICE_URL`) and the algorithm (`RS256`) of access tokens. `false`: signature only (historical behaviour). Evaluated on every verification, never blocking. |
| `auth-webhook-require-signature` | `true`: `POST /api/auth/disconnect` only accepts the `X-Auth-Webhook-*` signature (the legacy `?secret=` is refused). `false`: valid signature or legacy `?secret=`.                                                                                                      |

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

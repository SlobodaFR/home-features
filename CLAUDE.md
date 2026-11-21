# home-features (Kinetic Feature Management)

Feature flags and config management service, deployed at `features.sloboda.fr` on the same VPS as
the other `home-*` services. Users sign in through the central auth service (`home-auth`,
`auth.sloboda.fr`); other services read flags and configs through a public API authenticated with a
per-app API key (`docs/public-api.md`).

## Stack

- **Backend**: NestJS 12 + Express 5, TypeORM + better-sqlite3 (WAL mode, replicated by Litestream),
  class-validator / class-transformer, cookie-parser, jose (JWKS), @nestjs/config,
  @nestjs/serve-static, helmet, nestjs-pino. TypeScript 7, compiled by `tsc -p tsconfig.build.json`
  (no Nest CLI). Clean architecture: `domain / application / infrastructure / interfaces`.
- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS, react-router-dom. Clean architecture:
  `domain / application / infrastructure / presentation`.
- **Monorepo**: npm workspaces (`backend`, `frontend`), Node 26 (`.nvmrc`).
- **Tooling**: Oxlint (type-aware) + Oxfmt, Vitest (backend uses `unplugin-swc` for decorators),
  Husky (commitlint, lint-staged, pre-push runs lint and tests).
- **Docker**: one image; the Nest backend serves the built React app as static files
  (`backend/dist/public`).

## Structure

```
backend/src/
  domain/                      # entities and ports, no framework: app, environment, feature-flag,
                               # config-entry, api-key, user, auth, shared (slug, pseudonymize)
  application/                 # use cases and DTOs, one folder per aggregate (app, environment,
                               # feature-flag, config-entry, api-key, overview, public-api, auth)
  infrastructure/
    auth/                      # HttpOAuthClient, JwksAccessTokenVerifier
    config/                    # validateEnv (environment validated at startup)
    logging/                   # nestjs-pino config: serializers, redaction, whitelist err serializer
    observability/             # RuntimeHealthMonitor (event-loop lag, memory) for /healthz
    persistence/               # ORM entities (entities/index.ts = ENTITIES), repositories,
                               # migrations/ (MIGRATIONS), SchemaGuard, DatabaseModule, data-source.ts
  interfaces/http/
    controllers/               # apps, environments, flags, configs, api-keys, auth, me, health,
                               # public-api
    guards/                    # JwtAuthGuard (global), SameOriginGuard (global)
    decorators/                # @Public, @SkipSameOrigin, @CurrentUser
    modules/, dto/, security-headers.ts, auth-cookies.ts, auth-session.ts
  app.module.ts, main.ts, configure-app.ts, static-assets.ts

frontend/src/
  domain/ application/ infrastructure/ (api-client.ts) presentation/ (App, auth/, pages/)
```

Domain model: an `App` (owned by a user) has `Environment`s, `FeatureFlag`s (boolean per
environment), `ConfigEntry`s (STRING / NUMBER / BOOLEAN / JSON value per environment) and
`ApiKey`s (hashed, shown once at creation).

## HTTP surface and security

- Routes live under the `api` global prefix, except `GET /healthz` (internal, see below).
- **Auth**: `access_token` / `refresh_token` cookies issued after the OAuth2 code flow with
  home-auth; `JwtAuthGuard` is global and verifies the access token against the JWKS, refreshing
  the session when needed. `@Public()` opts a route out. `POST /api/auth/disconnect?secret=...` is
  the logout webhook called by home-auth.
- **Public API**: `GET /api/v1/flags-and-configs?environment=<slug>`, `Authorization: Bearer <api key>`,
  no cookie (`docs/public-api.md`).
- **CSRF**: `SameOriginGuard` is global; every mutation needs `Sec-Fetch-Site: same-origin` (or a
  trusted `Origin` = `FRONTEND_URL`) and a body that is not `application/x-www-form-urlencoded` or `text/plain`. `@SkipSameOrigin()` exempts server-to-server
  routes; today only `POST /api/auth/disconnect` and `PublicApiController`. A spec lists the exact set.
- **CORS**: none. The SPA is served by this service (same origin); the public API is called
  server-to-server.
- **Headers**: helmet with a CSP limited to what the front loads (own scripts and styles, Google
  Fonts) and HSTS.
- **Proxy**: `TRUST_PROXY_HOPS=1` behind Caddy so `req.ip` is the real client.
- **Logs**: JSON via nestjs-pino. Requests are logged as method, path and status only (`/assets/*` and `/healthz` not at all); errors are logged as
  `{ type, message, stack, code }` (a TypeORM `QueryFailedError` would otherwise log its
  parameters); authenticated requests carry `userRef`, an HMAC pseudonym of the user id
  (`pseudonymize()`, `PSEUDONYM_SECRET`). Never interpolate an email, name or token in a log or an
  error message.
- **Health**: `GET /healthz` (no session, outside `api`) returns `{ status, runtime }`. Caddy answers
  404 for `/healthz*`; the Docker `HEALTHCHECK` calls it inside the container.

## Database

SQLite through TypeORM with `synchronize: false` and `migrationsRun: true`. The initial migration
is hand-written with `IF NOT EXISTS` so it adopts the database that `synchronize` created. Any
entity change needs a new migration appended to `MIGRATIONS`
(`migrations/index.ts`); the migrations spec fails when entities and migrations diverge, and
`SchemaGuard` refuses to start when the live schema differs from the entities. Never re-enable
`synchronize`, never rebuild a table destructively (Litestream would replicate it).

```bash
npm run migration:generate -w backend -- src/infrastructure/persistence/migrations/<Name>  # review it, then append it to MIGRATIONS
npm run migration:show -w backend
```

## Environment

Validated at startup by `validateEnv` (production refuses to start on a missing or invalid value);
"Production" means `NODE_ENV=production`; the full list (including `NODE_ENV` and the `MINIO_*` Litestream variables read by the entrypoint) is in `README.md` and `backend/.env.example`.

| Variable                                                      | Production                                                             |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `AUTH_SERVICE_URL`, `FRONTEND_URL`                            | required, `https://`                                                   |
| `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, `AUTH_WEBHOOK_SECRET` | required                                                               |
| `PSEUDONYM_SECRET`                                            | required, at least 32 random bytes                                     |
| `DATABASE_PATH`                                               | optional, never empty (image default)                                  |
| `TRUST_PROXY_HOPS`, `PORT`                                    | integers; the image sets `PORT=3000`, deploy sets `TRUST_PROXY_HOPS=1` |

## Running locally

```bash
npm install
cp backend/.env.example backend/.env   # fill in AUTH_CLIENT_SECRET, AUTH_WEBHOOK_SECRET, etc.
npm run dev:backend    # tsc once, then node --watch on dist (re-run after editing sources), :3002
npm run dev:frontend   # Vite on :5173, proxies /api to :3002
```

## Tests and build

```bash
npm test                       # backend + frontend (vitest)
npm run build                  # builds frontend then backend (copies frontend/dist into backend/dist/public)
npm run lint                   # Oxlint (type-aware)
npm run format:check           # Oxfmt (`npm run format` writes)
npm run typecheck              # tsc backend + frontend
```

## Deployment

- Single Docker image (`Dockerfile`): Litestream + Node, `ENV PORT=3000`, `HEALTHCHECK` on `/healthz`.
- `deploy/docker-compose.yml`: service `features`, maps `127.0.0.1:3002:3000`, named volume
  `features-data`.
- `deploy/Caddyfile`: `features.sloboda.fr`, `respond /healthz* 404` then
  `reverse_proxy 127.0.0.1:3002`; copied to `/etc/caddy/sites/features.Caddyfile` by the deploy.
- `.github/workflows/`: `ci.yml` (lint, format, typecheck, tests, build; Docker build check on
  pull requests to `main`), `build-and-publish.yml`, `deploy-vps.yml`. Merging to `main` builds,
  publishes and deploys.
- Secrets live only in 1Password (`TECH/thomassloboda_home_secrets`), injected by `deploy-vps.yml`
  as `FEATURES_*` fields: `FEATURES_AUTH_CLIENT_ID`, `FEATURES_AUTH_SECRET`,
  `FEATURES_AUTH_WEBHOOK_SECRET`, `FEATURES_FRONTEND_URL`, `FEATURES_DATABASE_PATH`,
  `FEATURES_PSEUDONYM_SECRET`, `FEATURES_MINIO_REPLICA_PATH` (plus the shared VPS, `AUTH_BASE_URL`, MinIO and GitHub token fields).
  They must exist before the deploy job can succeed. `.dockerignore` keeps `.env` and
  `backend/data` out of the image.
- Port `3002` on the host (the app listens on `3000` in the container); `PORT` defaults to `3002`
  when running outside Docker.

## Conventions

The shared `home-*` conventions and their audit live in the home harness
(`~/.claude/home-harness/CONVENTIONS.md`, `node ~/.claude/home-harness/scripts/audit.mjs .`).
Commits follow Conventional Commits (commitlint), without attribution lines.

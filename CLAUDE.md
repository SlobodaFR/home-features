# home-features (Kinetic Feature Management)

Feature flags & config management service, deployed at `features.sloboda.fr` on the same VPS as
the sibling app `home-budget` (deployed at `budget.sloboda.fr`).

## Sibling reference

`/Users/thomassloboda/workspace/personal/budget` (home-budget) is the reference implementation for
stack, conventions, and the auth integration pattern. When in doubt about how something should be
structured, check the equivalent file there first. In particular, `backend/src/{domain,application,
infrastructure}/auth/*`, `domain/user/*`, and `interfaces/http/{auth-cookies.ts,guards,controllers,
modules}` were copied and adapted nearly verbatim from budget.

## Stack

- **Backend**: NestJS v10 + platform-express, TypeORM + better-sqlite3 (WAL mode for Litestream),
  class-validator/class-transformer, cookie-parser, jose (JWKS), @nestjs/config,
  @nestjs/serve-static. Clean architecture: `domain / application / infrastructure / interfaces`.
- **Frontend**: Vite + React + TypeScript + Tailwind CSS, react-router-dom. Clean architecture:
  `domain / application / infrastructure / presentation`.
- **Monorepo**: npm workspaces (`backend`, `frontend`).
- **Docker**: single image; the Nest backend serves the built React app as static files
  (`backend/dist/public`).

## Structure

```
backend/src/
  domain/auth/            # AccessTokenVerifier, OAuthClient, RevokedSessionRepository ports
  domain/user/            # User entity + UserRepository port
  application/auth/        # HandleOAuthCallbackUseCase, HandleSessionRevokedUseCase
  infrastructure/auth/      # HttpOAuthClient, JwksAccessTokenVerifier
  infrastructure/persistence/ # DatabaseModule, TypeORM entities/repositories (User, RevokedSession)
  interfaces/http/          # AuthController (/api/auth/*), MeController (/api/me), JwtAuthGuard,
                            # auth-cookies, decorators (CurrentUser, Public), modules

frontend/src/
  presentation/auth/        # AuthProvider, RequireAuth
  presentation/pages/        # LoginPage, HomePage
  infrastructure/           # api-client.ts
```

## Running locally

```bash
npm install
cp backend/.env.example backend/.env   # fill in AUTH_CLIENT_SECRET, AUTH_WEBHOOK_SECRET, etc.
npm run dev:backend    # Nest on :3002
npm run dev:frontend   # Vite on :5173, proxies /api to :3002
```

## Tests & build

```bash
npm test                       # backend (jest) + frontend (vitest)
npm run build                   # builds frontend then backend (copies frontend/dist into backend/dist/public)
npm run build -w backend        # backend only (requires frontend build first for copy-frontend step)
npm run build -w frontend        # frontend only
```

## Deployment

- Single Docker image (`Dockerfile`, mirrors budget's), exposing port 3000 internally.
- `deploy/docker-compose.yml`: service `features`, maps `127.0.0.1:3002:3000`, named volume
  `features-data`.
- `deploy/Caddyfile`: `features.sloboda.fr { reverse_proxy 127.0.0.1:3002 }`, imported via
  `sites/*` on the VPS (same mechanism as budget).
- `.github/workflows/`: CI mirrors budget's (`ci.yml`, `build-and-publish.yml`, `deploy-vps.yml`).
  The deploy workflow reuses the same 1Password vault (`TECH/thomassloboda_home_secrets`) but with
  `FEATURES_*`-prefixed secret names (`FEATURES_AUTH_CLIENT_ID`, `FEATURES_AUTH_SECRET`,
  `FEATURES_AUTH_WEBHOOK_SECRET`, `FEATURES_FRONTEND_URL`, `FEATURES_DATABASE_PATH`,
  `FEATURES_MINIO_REPLICA_PATH`) analogous to budget's `BUDGET_*` secrets — these must be created
  in 1Password before the deploy job will succeed.
- `PORT` defaults to `3002` for this app (budget uses `3001`) to avoid port collisions on the VPS.

## Follow-up work (not in this scaffold)

- Domain model: `App` / `Environment` / `FeatureFlag` / `Config` entities, CRUD use-cases,
  TypeORM entities/repositories, HTTP controllers + frontend pages.
- Public exposure API (API-key authenticated) for consuming apps to fetch flags/config.
- Promote flow between environments.
- Full frontend UI (beyond the placeholder login/home pages) — see Stitch designs when available.

## Current scaffold state

This repo currently contains only the scaffold: npm workspace, NestJS backend with auth wired
end-to-end (login/callback/logout/disconnect + `/api/me`), minimal React frontend (login redirect +
"Logged in as {email}" home page + logout), Docker/Caddy/CI/Litestream plumbing copied from budget.
No feature-flag domain entities yet.

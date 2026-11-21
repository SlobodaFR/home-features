# Public exposure API

This API lets other Sloboda apps (e.g. `home-budget`, `home-auth`) fetch this app's
feature flags and config values at runtime, authenticated with an API key bound to one App
and one environment.

It is separate from the OAuth2-session-based management API used by the admin UI —
no cookies, no login flow. Just an opaque bearer token.

For boolean feature flags, prefer the OpenFeature-compatible OFREP endpoints
([ofrep.md](ofrep.md)), which consumers use through the official OpenFeature SDKs. This endpoint
remains for configs.

## Authentication

Generate an API key from the app's detail page in the Kinetic Feature Management UI
("API keys" section), choosing its **environment** and its **scope**. The plaintext key is
shown **once**, at creation time, and is never retrievable again — store it securely (e.g. in
your service's secrets/env vars).

- **Format**: `hf_` followed by 64 lowercase hex characters (`^hf_[0-9a-f]{64}$`). Only the
  sha256 of the whole token is stored. Keys created before this format were bound to no
  environment and have been deleted by the `ApiKeyEnvironment` migration: create new ones.
- **Environment**: a key reads exactly one environment of its App, chosen at creation. The
  caller never chooses it. An environment cannot be deleted while keys are bound to it (`409`):
  revoke them first.
- **Scope**: `server` (a backend: every flag and config of the environment) or `web` (a
  browser-facing proxy: only the flags marked client-exposed, never the configs).

Each request must include:

```
Authorization: Bearer hf_<64 hex>
```

If the header is missing, malformed, or the key is unknown/revoked/not in the `hf_` format,
the API responds with `401 Unauthorized`.

## Endpoint

### `GET /api/v1/flags-and-configs?environment=<environmentSlug>`

Returns all feature flags and config entries of the key's App in the key's environment.

**Query parameters**

| Name          | Required | Description                                                                                   |
| ------------- | -------- | --------------------------------------------------------------------------------------------- |
| `environment` | yes      | Slug of the key's own environment (e.g. `production`). Any other value is refused with `400`. |

**Response `200 OK`**

```json
{
  "app": "ecommerce-core",
  "environment": "production",
  "flags": {
    "new-checkout-flow": true,
    "dark-mode": false
  },
  "configs": {
    "max-retries": 3,
    "feature-banner-text": "Welcome",
    "payment-providers": ["stripe", "paypal"]
  }
}
```

- `app` / `environment`: slugs of the resolved App and Environment.
- `flags`: map of feature flag `key` -> `enabled` (boolean). A flag with no value set
  for this environment defaults to `false`.
- `configs`: map of config entry `key` -> value, parsed according to its configured
  type:
  - `STRING` -> string
  - `NUMBER` -> number
  - `BOOLEAN` -> boolean
  - `JSON` -> parsed JSON value (object/array/etc.)

  A config entry with no value set for this environment is returned as `null`.

A `web` key receives only the client-exposed flags and an empty `configs` object.

**Error responses**

| Status                  | When                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `400 Bad Request`       | `environment` is missing or is not the environment the key is bound to.                        |
| `401 Unauthorized`      | Missing/malformed `Authorization` header, or the API key is unknown/revoked.                   |
| `429 Too Many Requests` | Over 100 requests per minute from the same IP (`Retry-After` in seconds; Nest's default body). |

## Side effects

A successful lookup updates the API key's `lastUsedAt` timestamp at most once every ten
minutes per key (in-memory debounce; best-effort - this never causes the request to fail).

## Example

```bash
curl -s "https://features.sloboda.fr/api/v1/flags-and-configs?environment=production" \
  -H "Authorization: Bearer hf_<64 hex>"
```

## Rate limiting

`@nestjs/throttler`, in memory (counters reset on restart), one-minute windows, client IP taken
from `req.ip` through `TRUST_PROXY_HOPS` (1 behind Caddy), IPv6 grouped by /64. Every `429`
carries `Retry-After` in seconds.

- Every route, this one included: 100 requests per minute per route and per client IP.
- API-key routes (OFREP): authenticated first, then 300 requests per minute **per key** (all the
  services of the VPS share one IP); failed authentications are limited to 20 per minute per
  client IP, then `429` (random bearers do not get fresh budgets; a valid key still passes).
- `/healthz` is never limited.

## Managing API keys

Management of API keys (list / create / revoke) requires an authenticated session
(OAuth2 cookie) and is done via:

- `GET /api/apps/:appId/api-keys` — list keys for an app (id, name, environmentId, scope,
  createdAt, lastUsedAt - never the secret).
- `POST /api/apps/:appId/api-keys` — create a new key. Body:
  `{ "name": "production server", "environmentId": "<environment id>", "scope": "server" }`
  (`scope`: `server` or `web`; the environment must belong to the app, `404` otherwise).
  Response includes the plaintext `key` **once**.
- `DELETE /api/api-keys/:id` — revoke (delete) a key.

A single App can have multiple API keys (e.g. one per environment and consuming service),
each independently revocable.

## Flag lifecycle (management API)

- A flag's `key` is **immutable**: consumers reference it in code, so `PATCH /api/flags/:id`
  refuses a different `key` (`400`); `name`, `description` and `clientExposed` can change.
- `clientExposed` (default `false`) makes a flag visible to `web` keys. Leave it off for
  anything a browser must not learn.
- `lastEvaluatedAt` is the last time a consumer read the flag (updated at most every ten
  minutes); the UI shows it.
- `DELETE /api/flags/:id` on a flag that is on in at least one environment is refused (`409`)
  unless the body confirms it by naming the key: `{ "confirm": "<key>" }`. Its consumers would
  fall back to their code default, i.e. the feature turns off.
- Every change of a flag value (UI, and the emergency CLI) is appended to the
  `flag_value_changes` journal in the same transaction as the value itself (old value, `null`
  when unset, new value, actor, source `ui`|`cli`, time), and logged as one structured line
  (`event: "flag_value_changed"`, actor pseudonymized as `actorRef`). The journal is append-only
  (SQLite triggers refuse UPDATE and DELETE) and outlives deleted flags and environments.
  `GET /api/flags/:id/history` returns the latest 200 entries, newest first; the UI shows them
  under each flag ("History"). Once a flag is deleted its history stays in the database but is
  no longer reachable from the UI or the API.
- Retention: journal rows are never deleted, even with their app. For a UI change `actor` is the
  user's display name as carried by the session token at that time; for a CLI change, the
  `--actor` value. Erasing a name from the journal means dropping the triggers by hand (a
  deliberate operator action; this is a single-user service).

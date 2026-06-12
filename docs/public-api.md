# Public exposure API

This API lets other Sloboda apps (e.g. `home-budget`, `home-auth`) fetch this app's
feature flags and config values at runtime, authenticated with a per-App API key.

It is separate from the OAuth2-session-based management API used by the admin UI —
no cookies, no login flow. Just an opaque bearer token.

## Authentication

Generate an API key from the app's detail page in the Kinetic Feature Management UI
("API keys" section). The plaintext key is shown **once**, at creation time, and is
never retrievable again — store it securely (e.g. in your service's secrets/env vars).

Each request must include:

```
Authorization: Bearer <api-key>
```

If the header is missing, malformed, or the key is unknown/revoked, the API responds
with `401 Unauthorized`.

## Endpoint

### `GET /api/v1/flags-and-configs?environment=<environmentSlug>`

Returns all feature flags and config entries for the App owning the API key, scoped
to the given environment.

**Query parameters**

| Name | Required | Description |
| --- | --- | --- |
| `environment` | yes | Slug of the environment (e.g. `production`, `staging`) within the App that owns the API key. |

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

**Error responses**

| Status | When |
| --- | --- |
| `401 Unauthorized` | Missing/malformed `Authorization` header, or the API key is unknown/revoked. |
| `404 Not Found` | The `environment` slug does not exist for the App that owns the API key. |

## Side effects

On every successful lookup, the API key's `lastUsedAt` timestamp is updated
(best-effort - this never causes the request to fail).

## Example

```bash
curl -s "https://features.sloboda.fr/api/v1/flags-and-configs?environment=production" \
  -H "Authorization: Bearer <api-key>"
```

## Rate limiting

There is currently no rate limiting or abuse prevention on this endpoint
(no NestJS throttler is configured in this app, and none was found in the sibling
`home-budget` / `home-auth` services to mirror). This is a known follow-up — consider
adding `@nestjs/throttler` if this endpoint sees meaningful external traffic.

## Managing API keys

Management of API keys (list / create / revoke) requires an authenticated session
(OAuth2 cookie) and is done via:

- `GET /api/apps/:appId/api-keys` — list keys for an app (id, name, createdAt, lastUsedAt - never the secret).
- `POST /api/apps/:appId/api-keys` — create a new key. Body: `{ "name": "production server" }`.
  Response includes the plaintext `key` **once**.
- `DELETE /api/api-keys/:id` — revoke (delete) a key.

A single App can have multiple API keys (e.g. one per deploy environment or
consuming service), each independently revocable.

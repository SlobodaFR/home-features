# OFREP evaluation API

home-features is an [OpenFeature](https://openfeature.dev) flag provider through the
**OpenFeature Remote Evaluation Protocol (OFREP) 0.4.0**: consumers use the official OpenFeature
SDK and OFREP provider instead of a home-made client. Boolean flags only; configs stay on the
legacy `GET /api/v1/flags-and-configs` ([public-api.md](public-api.md)).

- **Base URL for providers**: `https://features.sloboda.fr/api` (providers append
  `/ofrep/v1/...`).
- **Authentication**: `Authorization: Bearer hf_<64 hex>`, an API key created in the UI for one
  app, one environment and a scope (`server` or `web`). The environment is always the key's; the
  evaluation context never chooses it. A session cookie alone is refused (`401`).
- **No targeting**: the `context` is accepted (it must be an object when present), ignored, never
  stored, never logged.

## Endpoints

### `POST /api/ofrep/v1/evaluate/flags/{key}`

Body (optional): `{ "context": { ... } }`.

| Status | Body                                                                                | When                                                                  |
| ------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `200`  | `{"key","value":true\|false,"reason":"STATIC","variant":"on"\|"off","metadata":{}}` | The flag has a value in the key's environment.                        |
| `200`  | `{"key","reason":"DISABLED","metadata":{}}`, **no `value` nor `variant`**           | No value in that environment: the consumer's code default applies.    |
| `404`  | `{"key","errorCode":"FLAG_NOT_FOUND","errorDetails"}`                               | Unknown or malformed key, or a flag not client-exposed for a web key. |
| `400`  | `{"key","errorCode":"INVALID_CONTEXT","errorDetails"}`                              | Body not a JSON object, `context` not an object, body over 64 KiB.    |

### `POST /api/ofrep/v1/evaluate/flags` (bulk)

Body (optional): `{ "context": { ... } }`. Answers `200 {"flags": [ ...items as above... ]}`
sorted by key, or `400 {"errorCode":"INVALID_CONTEXT","errorDetails"}` (no `key`).

- `ETag`: strong, quoted,
  `base64url(sha256(<environment id> + "\n" + <sorted lines "key=on|off|unset" joined by "\n">))`.
- `Cache-Control: private, no-cache`.
- `If-None-Match` (weak comparison: `W/` accepted, comma-separated lists, `*`) matching the
  current ETag: `304` without body (same `ETag` and `Cache-Control`). Handled by the service:
  Express only does it for `GET`.

### Common to both

- Every response is `application/json` (except `304`).
- `401 {"errorDetails"}`: bearer missing, malformed, unknown or revoked.
- `429 {"errorDetails"}` with `Retry-After` in seconds: 300 requests per minute per key; 20 failed
  authentications per minute per client IP. A valid key is never refused because of others'
  failures (all VPS services share one egress IP).
- `500 {"errorDetails":"internal error"}`.
- Never Nest's `{statusCode, message}` shape: a controller-scoped exception filter, and a body
  reader that runs before Nest's JSON parser (malformed JSON would otherwise bypass the filter).

## Scopes

- `server` key: every flag of its environment. For backends.
- `web` key: only the flags marked **client-exposed** in the UI (default: not exposed); any other
  flag answers `404 FLAG_NOT_FOUND`, exactly like a missing one. For the same-origin proxy a
  front-end backend puts in front of its SPA; consumers never filter flags themselves.

## Side effects

Each evaluation updates the flag's `lastEvaluatedAt` and the key's `lastUsedAt`, each at most once
every ten minutes (in-memory debounce), shown in the UI.

## Consumer configuration (NestJS backend)

```ts
import { OpenFeature } from '@openfeature/server-sdk';
import { OFREPProvider } from '@openfeature/ofrep-provider';

// Never setProviderAndWait: startup must not wait for home-features.
OpenFeature.setProvider(
  new OFREPProvider({
    baseUrl: process.env.FEATURES_OFREP_URL, // https://features.sloboda.fr/api
    timeoutMs: 500,
    headers: [['Authorization', `Bearer ${process.env.FEATURES_API_KEY}`]],
  }),
);
const enabled = await OpenFeature.getClient().getBooleanValue('my-flag', false);
```

The provider also reads `OFREP_ENDPOINT` and `OFREP_HEADERS` from the environment; consumers must
refuse or ignore them (check at startup) so the endpoint and the key only come from
`FEATURES_OFREP_URL` / `FEATURES_API_KEY`. The full consumer contract (memo, last-known value,
emergency pins, web proxy) is described in the OFREP contract and implemented by the home-auth
reference adapter.

## Tests

`backend/src/interfaces/http/ofrep/ofrep.contract.spec.ts` runs the official SDKs
(`@openfeature/server-sdk` + `@openfeature/ofrep-provider`, `@openfeature/web-sdk` +
`@openfeature/ofrep-web-provider`, devDependencies) against the real HTTP server: true/false,
DISABLED → code default, FLAG_NOT_FOUND → default, TYPE_MISMATCH, revoked key, server not
answering within the timeout, bulk then `304` on polling, web-key filtering.

import { Logger } from '@nestjs/common';
import request from 'supertest';
import { FeatureFlagRepository } from '../../../domain/feature-flag/feature-flag.repository';
import { generateApiKeyToken } from '../../../domain/api-key/api-key-token';
import {
  ofrepTestApp,
  OfrepFixture,
} from '../../../test-support/ofrep-test-app';
import { API_KEY_AUTH_FAILURE_LIMIT } from '../throttling';

const SINGLE = '/api/ofrep/v1/evaluate/flags';

describe('OFREP over HTTP', () => {
  let fixture: OfrepFixture;
  let ip = 0;

  beforeAll(async () => {
    fixture = await ofrepTestApp();
  });

  afterAll(async () => {
    await fixture.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** A fresh client IP per request group, so the failed-auth budget never leaks between tests. */
  function post(path: string, key: string | null = fixture.keys.server) {
    ip += 1;
    const req = request(fixture.app.getHttpServer())
      .post(path)
      .set('X-Forwarded-For', `203.0.113.${(ip % 250).toString()}`)
      .set('Content-Type', 'application/json');
    return key ? req.set('Authorization', `Bearer ${key}`) : req;
  }

  function expectJson(res: request.Response) {
    expect(res.headers['content-type']).toMatch(/^application\/json/);
  }

  describe('single flag', () => {
    it('evaluates an enabled flag: 200 STATIC on', async () => {
      const res = await post(`${SINGLE}/on-flag`).send({
        context: { targetingKey: 'u1' },
      });

      expect(res.status).toBe(200);
      expectJson(res);
      expect(res.body).toEqual({
        key: 'on-flag',
        value: true,
        reason: 'STATIC',
        variant: 'on',
        metadata: {},
      });
    });

    it('evaluates a disabled flag: 200 STATIC off, without any body', async () => {
      const res = await post(`${SINGLE}/off-flag`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        key: 'off-flag',
        value: false,
        reason: 'STATIC',
        variant: 'off',
        metadata: {},
      });
    });

    it('answers DISABLED without value nor variant when the environment has no value', async () => {
      const res = await post(`${SINGLE}/unset-flag`).send({});

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        key: 'unset-flag',
        reason: 'DISABLED',
        metadata: {},
      });
    });

    it('reads the environment of the key, never the context', async () => {
      const res = await post(`${SINGLE}/on-flag`, fixture.keys.staging).send({
        context: { environment: 'production' },
      });

      expect(res.body).toMatchObject({ value: false, variant: 'off' });
    });

    it.each([
      ['an unknown flag', 'nope'],
      ['a malformed key', 'Not_A_Key'],
    ])('answers 404 FLAG_NOT_FOUND for %s', async (_label, key) => {
      const res = await post(`${SINGLE}/${key}`);

      expect(res.status).toBe(404);
      expectJson(res);
      expect(res.body).toEqual({
        key,
        errorCode: 'FLAG_NOT_FOUND',
        errorDetails: expect.any(String) as string,
      });
    });

    it('hides a non client-exposed flag from a web key exactly like a missing one', async () => {
      const hidden = await post(`${SINGLE}/on-flag`, fixture.keys.web);
      const exposed = await post(`${SINGLE}/exposed-flag`, fixture.keys.web);

      expect(hidden.status).toBe(404);
      expect(hidden.body).toEqual({
        key: 'on-flag',
        errorCode: 'FLAG_NOT_FOUND',
        errorDetails: 'Flag not found',
      });
      expect(exposed.body).toMatchObject({ key: 'exposed-flag', value: true });
    });

    it.each([
      ['a string context', { context: 'u1' }],
      ['an array context', { context: [1] }],
      ['a null context', { context: null }],
      ['an array body', [1]],
    ])('answers 400 INVALID_CONTEXT for %s', async (_label, body) => {
      const res = await post(`${SINGLE}/on-flag`).send(body);

      expect(res.status).toBe(400);
      expectJson(res);
      expect(res.body).toEqual({
        key: 'on-flag',
        errorCode: 'INVALID_CONTEXT',
        errorDetails: expect.any(String) as string,
      });
    });

    it('answers 400 INVALID_CONTEXT, OFREP-shaped, to malformed JSON', async () => {
      const res = await post(`${SINGLE}/on-flag`).send('{"context": ');

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        key: 'on-flag',
        errorCode: 'INVALID_CONTEXT',
      });
      expect(res.body).not.toHaveProperty('statusCode');
    });

    it('answers 400 to a body over 64 KiB', async () => {
      const res = await post(`${SINGLE}/on-flag`).send({
        context: { blob: 'x'.repeat(70 * 1024) },
      });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ errorCode: 'INVALID_CONTEXT' });
    });
  });

  describe('bulk', () => {
    it('evaluates every flag of the environment with a strong ETag and no shared caching', async () => {
      const res = await post(SINGLE).send({ context: {} });

      expect(res.status).toBe(200);
      expectJson(res);
      expect(res.headers.etag).toMatch(/^"[A-Za-z0-9_-]{43}"$/);
      expect(res.headers['cache-control']).toBe('private, no-cache');
      expect(res.body).toEqual({
        flags: [
          {
            key: 'exposed-flag',
            value: true,
            reason: 'STATIC',
            variant: 'on',
            metadata: {},
          },
          {
            key: 'off-flag',
            value: false,
            reason: 'STATIC',
            variant: 'off',
            metadata: {},
          },
          {
            key: 'on-flag',
            value: true,
            reason: 'STATIC',
            variant: 'on',
            metadata: {},
          },
          { key: 'unset-flag', reason: 'DISABLED', metadata: {} },
        ],
      });
    });

    it('gives a web key only the client-exposed flags', async () => {
      const res = await post(SINGLE, fixture.keys.web);

      expect(res.body).toEqual({
        flags: [
          {
            key: 'exposed-flag',
            value: true,
            reason: 'STATIC',
            variant: 'on',
            metadata: {},
          },
        ],
      });
    });

    it.each([
      ['the exact tag', (etag: string) => etag],
      ['its weak form', (etag: string) => `W/${etag}`],
      ['a list containing it', (etag: string) => `"other", ${etag}`],
      ['a wildcard', () => '*'],
    ])(
      'answers 304 without body to If-None-Match with %s',
      async (_label, header) => {
        const first = await post(SINGLE);
        const etag = first.headers.etag;

        const res = await post(SINGLE).set('If-None-Match', header(etag));

        expect(res.status).toBe(304);
        expect(res.text).toBe('');
        expect(res.headers.etag).toBe(etag);
        expect(res.headers['cache-control']).toBe('private, no-cache');
      },
    );

    it('answers 200 with a new ETag once a value changed', async () => {
      const first = await post(SINGLE);
      await fixture.dataSource.query(
        "UPDATE flag_values SET enabled = 0 WHERE id = 'v1'",
      );

      const res = await post(SINGLE).set('If-None-Match', first.headers.etag);

      await fixture.dataSource.query(
        "UPDATE flag_values SET enabled = 1 WHERE id = 'v1'",
      );
      expect(res.status).toBe(200);
      expect(res.headers.etag).not.toBe(first.headers.etag);
    });

    it('answers 400 INVALID_CONTEXT without key', async () => {
      const res = await post(SINGLE).send({ context: 'nope' });

      expect(res.status).toBe(400);
      expectJson(res);
      expect(res.body).toEqual({
        errorCode: 'INVALID_CONTEXT',
        errorDetails: expect.any(String) as string,
      });
    });
  });

  describe('authentication, errors and limits', () => {
    it.each([
      ['no Authorization header', null],
      ['an unknown key', generateApiKeyToken()],
      ['a legacy-format key', '0'.repeat(64)],
    ])('answers 401 {errorDetails} to %s', async (_label, key) => {
      const res = await post(`${SINGLE}/on-flag`, key);

      expect(res.status).toBe(401);
      expectJson(res);
      expect(res.body).toEqual({ errorDetails: expect.any(String) as string });
    });

    // The session guard is bypassed (@Public) and never consulted: its stubs would throw.
    it('answers 401 to a session cookie alone', async () => {
      const res = await post(`${SINGLE}/on-flag`, null).set(
        'Cookie',
        'access_token=abc; refresh_token=def',
      );

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ errorDetails: expect.any(String) as string });
    });

    // Cross-site POST with no Origin: SameOriginGuard would refuse it (@SkipSameOrigin).
    it('accepts a server-to-server POST without Origin or Sec-Fetch-Site', async () => {
      const res = await post(`${SINGLE}/on-flag`).set(
        'Sec-Fetch-Site',
        'cross-site',
      );

      expect(res.status).toBe(200);
    });

    // All VPS services share one egress IP: the per-IP default throttler must not apply here.
    it('lets one key from one IP go past the default 100 requests per minute', async () => {
      const server = fixture.app.getHttpServer();
      const statuses = new Set<number>();
      for (let i = 0; i < 110; i += 1) {
        const res = await request(server)
          .post(`${SINGLE}/on-flag`)
          .set('X-Forwarded-For', '192.0.2.200')
          .set('Authorization', `Bearer ${fixture.keys.staging}`);
        statuses.add(res.status);
      }

      expect(statuses).toEqual(new Set([200]));
    });

    it('answers 429 {errorDetails} with Retry-After in seconds after 20 failed authentications', async () => {
      const server = fixture.app.getHttpServer();
      const from = (r: request.Test) => r.set('X-Forwarded-For', '192.0.2.77');
      for (let i = 0; i < API_KEY_AUTH_FAILURE_LIMIT; i += 1) {
        await from(request(server).post(`${SINGLE}/on-flag`));
      }

      const res = await from(request(server).post(`${SINGLE}/on-flag`));

      expect(res.status).toBe(429);
      expectJson(res);
      expect(res.body).toEqual({ errorDetails: expect.any(String) as string });
      expect(Number(res.headers['retry-after'])).toBeGreaterThanOrEqual(59);
    });

    it('answers 500 {errorDetails: "internal error"} and never logs the context', async () => {
      const repository = fixture.app.get(FeatureFlagRepository);
      vi.spyOn(repository, 'findByKey').mockRejectedValue(
        new Error('disk on fire'),
      );
      const errors = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      const res = await post(`${SINGLE}/on-flag`).send({
        context: { email: 'secret-context@example.com' },
      });

      expect(res.status).toBe(500);
      expectJson(res);
      expect(res.body).toEqual({ errorDetails: 'internal error' });
      expect(errors).toHaveBeenCalled();
      expect(JSON.stringify(errors.mock.calls)).not.toContain('secret-context');
    });

    it('records the last evaluation and the key use', async () => {
      await post(`${SINGLE}/off-flag`);

      const [flag]: { last_evaluated_at: string | null }[] =
        await fixture.dataSource.query(
          "SELECT last_evaluated_at FROM feature_flags WHERE id = 'f-off'",
        );
      const [key]: { last_used_at: string | null }[] =
        await fixture.dataSource.query(
          "SELECT last_used_at FROM api_keys WHERE id = 'k-server'",
        );
      expect(flag.last_evaluated_at).not.toBeNull();
      expect(key.last_used_at).not.toBeNull();
    });
  });
});

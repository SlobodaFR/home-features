import { OFREPProvider } from '@openfeature/ofrep-provider';
import { OFREPWebProvider } from '@openfeature/ofrep-web-provider';
import { OpenFeature as ServerOpenFeature } from '@openfeature/server-sdk';
import { OpenFeature as WebOpenFeature } from '@openfeature/web-sdk';
import { createServer, Server } from 'http';
import type { AddressInfo } from 'net';
import {
  generateApiKeyToken,
  hashApiKeyToken,
} from '../../../domain/api-key/api-key-token';
import {
  ofrepTestApp,
  OfrepFixture,
} from '../../../test-support/ofrep-test-app';

/**
 * Contract tests: the official OpenFeature SDKs and OFREP providers, as consumers use them,
 * against the real HTTP server (app.listen(0)).
 */
describe('OFREP contract with the OpenFeature SDKs', () => {
  let fixture: OfrepFixture;
  let baseUrl: string;

  beforeAll(async () => {
    fixture = await ofrepTestApp();
    await fixture.app.listen(0, '127.0.0.1');
    const { port } = fixture.app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port.toString()}/api`;
  });

  afterAll(async () => {
    await ServerOpenFeature.close();
    await WebOpenFeature.close();
    await fixture.close();
  });

  describe('@openfeature/server-sdk + @openfeature/ofrep-provider', () => {
    let domain = 0;

    async function serverClient(key: string, url = baseUrl) {
      domain += 1;
      const name = `server-${domain.toString()}`;
      await ServerOpenFeature.setProviderAndWait(
        name,
        new OFREPProvider({
          baseUrl: url,
          timeoutMs: 500,
          headers: [['Authorization', `Bearer ${key}`]],
        }),
      );
      return ServerOpenFeature.getClient(name);
    }

    it('reads true and false', async () => {
      const client = await serverClient(fixture.keys.server);

      const on = await client.getBooleanDetails('on-flag', false);
      const off = await client.getBooleanDetails('off-flag', true);

      expect(on).toMatchObject({
        value: true,
        reason: 'STATIC',
        variant: 'on',
      });
      expect(on.errorCode).toBeUndefined();
      expect(off).toMatchObject({
        value: false,
        reason: 'STATIC',
        variant: 'off',
      });
    });

    it('falls back to the code default on DISABLED, without error', async () => {
      const client = await serverClient(fixture.keys.server);

      const withTrue = await client.getBooleanDetails('unset-flag', true);
      const withFalse = await client.getBooleanDetails('unset-flag', false);

      expect(withTrue).toMatchObject({ value: true, reason: 'DISABLED' });
      expect(withTrue.errorCode).toBeUndefined();
      expect(withFalse.value).toBe(false);
    });

    it('falls back to the default on FLAG_NOT_FOUND', async () => {
      const client = await serverClient(fixture.keys.server);

      const details = await client.getBooleanDetails('deleted-flag', true);

      expect(details).toMatchObject({
        value: true,
        reason: 'ERROR',
        errorCode: 'FLAG_NOT_FOUND',
      });
    });

    it('reports TYPE_MISMATCH when a boolean flag is read as a string', async () => {
      const client = await serverClient(fixture.keys.server);

      const details = await client.getStringDetails('on-flag', 'fallback');

      expect(details).toMatchObject({
        value: 'fallback',
        reason: 'ERROR',
        errorCode: 'TYPE_MISMATCH',
      });
    });

    it('falls back to the default once the key is revoked', async () => {
      const token = generateApiKeyToken();
      await fixture.dataSource.query(
        "INSERT INTO api_keys (id, app_id, name, key_hash, created_at, environment_id, scope) VALUES ('k-revoked', 'a1', 'revoked', ?, '2026-11-01 10:00:00', 'e-prod', 'server')",
        [hashApiKeyToken(token)],
      );
      const client = await serverClient(token);
      expect(await client.getBooleanValue('on-flag', false)).toBe(true);

      await fixture.dataSource.query(
        "DELETE FROM api_keys WHERE id = 'k-revoked'",
      );
      const details = await client.getBooleanDetails('on-flag', false);

      expect(details).toMatchObject({ value: false, reason: 'ERROR' });
    });

    describe('when home-features does not answer', () => {
      let silent: Server;
      let silentUrl: string;

      beforeAll(async () => {
        // Accepts connections and never responds.
        silent = createServer(() => undefined);
        await new Promise<void>((resolve) =>
          silent.listen(0, '127.0.0.1', resolve),
        );
        const { port } = silent.address() as AddressInfo;
        silentUrl = `http://127.0.0.1:${port.toString()}/api`;
      });

      afterAll(async () => {
        silent.closeAllConnections();
        await new Promise((resolve) => silent.close(resolve));
      });

      it('falls back to the default within the timeout', async () => {
        const client = await serverClient(fixture.keys.server, silentUrl);
        const started = Date.now();

        const details = await client.getBooleanDetails('on-flag', false);

        expect(Date.now() - started).toBeLessThan(2000);
        expect(details).toMatchObject({ value: false, reason: 'ERROR' });
      });
    });
  });

  describe('@openfeature/web-sdk + @openfeature/ofrep-web-provider', () => {
    it('loads the flags in bulk, then polls and gets 304 while nothing changes', async () => {
      const calls: { status: number; ifNoneMatch: string | null }[] = [];
      const recordingFetch = async (
        input: string | URL | Request,
        init?: RequestInit,
      ): Promise<Response> => {
        const response = await fetch(input, init);
        const request = input instanceof Request ? input : null;
        calls.push({
          status: response.status,
          ifNoneMatch: request?.headers.get('If-None-Match') ?? null,
        });
        return response;
      };
      const provider = new OFREPWebProvider({
        baseUrl,
        headers: [['Authorization', `Bearer ${fixture.keys.web}`]],
        pollInterval: 100,
        cacheMode: 'disabled',
        fetchImplementation: recordingFetch,
      });

      await WebOpenFeature.setProviderAndWait('web', provider);
      const client = WebOpenFeature.getClient('web');
      await new Promise((resolve) => setTimeout(resolve, 450));

      // Web key: only the client-exposed flag exists for this client.
      expect(client.getBooleanDetails('exposed-flag', false)).toMatchObject({
        value: true,
        reason: 'STATIC',
      });
      expect(client.getBooleanDetails('on-flag', false)).toMatchObject({
        value: false,
        reason: 'ERROR',
        errorCode: 'FLAG_NOT_FOUND',
      });
      expect(calls[0]).toEqual({ status: 200, ifNoneMatch: null });
      const polls = calls.slice(1);
      expect(polls.length).toBeGreaterThan(0);
      expect(polls.every((call) => call.status === 304)).toBe(true);
      expect(polls.every((call) => call.ifNoneMatch?.startsWith('"'))).toBe(
        true,
      );
      await WebOpenFeature.clearProviders();
    });
  });
});

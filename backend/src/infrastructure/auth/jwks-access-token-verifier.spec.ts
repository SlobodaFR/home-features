import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { exportJWK, generateKeyPair, JWK, KeyLike, SignJWT } from 'jose';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { testConfigModule } from '../../test-support/test-config.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { JwksAccessTokenVerifier } from './jwks-access-token-verifier';

const FLAG = 'auth-verify-token-claims';
const CLIENT_ID = 'features-client';

class FakeFlags extends FeatureFlags {
  enabled = false;
  readonly asked: [string, boolean][] = [];
  async isEnabled(key: string, codeDefault: boolean): Promise<boolean> {
    this.asked.push([key, codeDefault]);
    return key === FLAG ? this.enabled : codeDefault;
  }
}

describe('JwksAccessTokenVerifier', () => {
  let server: Server;
  let origin: string;
  let privateKey: KeyLike;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256', { extractable: true });
    privateKey = pair.privateKey;
    const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'k1' };
    // PS256 and RS256 share the same RSA key: the JWKS does not pin an algorithm.
    server = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        req.url === '/.well-known/jwks.json'
          ? JSON.stringify({ keys: [jwk] })
          : '{}',
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  function verifier(flags: FeatureFlags, authServiceUrl = origin) {
    const config = new ConfigService({
      AUTH_SERVICE_URL: authServiceUrl,
      AUTH_CLIENT_ID: CLIENT_ID,
    });
    return new JwksAccessTokenVerifier(config, flags);
  }

  function token(
    claims: { aud?: string | string[]; iss?: string; alg?: string } = {},
  ): Promise<string> {
    const jwt = new SignJWT({ email: 'a@b.test', name: 'Alice' })
      .setProtectedHeader({ alg: claims.alg ?? 'RS256', kid: 'k1' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('5m');
    const aud = 'aud' in claims ? claims.aud : CLIENT_ID;
    if (aud !== undefined) jwt.setAudience(aud);
    const iss = 'iss' in claims ? claims.iss : origin;
    if (iss !== undefined) jwt.setIssuer(iss);
    return jwt.sign(privateKey);
  }

  describe(`${FLAG} off (current behaviour)`, () => {
    it('reads the flag with false as the code default', async () => {
      const flags = new FakeFlags();
      await verifier(flags).verify(await token());
      expect(flags.asked).toEqual([[FLAG, false]]);
    });

    it('accepts a valid token', async () => {
      const result = await verifier(new FakeFlags()).verify(await token());
      expect(result).toMatchObject({
        sub: 'user-1',
        email: 'a@b.test',
        name: 'Alice',
      });
    });

    it('checks neither audience, issuer nor algorithm', async () => {
      const v = verifier(new FakeFlags());
      expect(
        await v.verify(await token({ aud: 'another-app' })),
      ).not.toBeNull();
      expect(
        await v.verify(await token({ iss: 'https://evil.example' })),
      ).not.toBeNull();
      expect(
        await v.verify(await token({ aud: undefined, iss: undefined })),
      ).not.toBeNull();
      expect(await v.verify(await token({ alg: 'PS256' }))).not.toBeNull();
    });

    it('still rejects a token signed by another key', async () => {
      const other = await generateKeyPair('RS256');
      const forged = await new SignJWT({ email: 'a@b.test', name: 'Alice' })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setSubject('user-1')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(other.privateKey);
      expect(await verifier(new FakeFlags()).verify(forged)).toBeNull();
    });
  });

  describe(`${FLAG} on`, () => {
    function strict(authServiceUrl?: string) {
      const flags = new FakeFlags();
      flags.enabled = true;
      return verifier(flags, authServiceUrl);
    }

    it('accepts a valid token (audience, issuer, RS256)', async () => {
      const result = await strict().verify(await token());
      expect(result).toMatchObject({ sub: 'user-1', name: 'Alice' });
    });

    it("rejects another app's audience", async () => {
      expect(
        await strict().verify(await token({ aud: 'another-app' })),
      ).toBeNull();
    });

    it('rejects a missing audience', async () => {
      expect(await strict().verify(await token({ aud: undefined }))).toBeNull();
    });

    it('rejects a wrong or missing issuer', async () => {
      const v = strict();
      expect(
        await v.verify(await token({ iss: 'https://evil.example' })),
      ).toBeNull();
      expect(await v.verify(await token({ iss: undefined }))).toBeNull();
    });

    it('rejects an algorithm other than RS256', async () => {
      expect(await strict().verify(await token({ alg: 'PS256' }))).toBeNull();
    });

    it('compares the issuer to the origin of AUTH_SERVICE_URL (no path, no trailing slash)', async () => {
      const v = strict(`${origin}/`);
      expect(await v.verify(await token())).not.toBeNull();
      expect(await v.verify(await token({ iss: `${origin}/` }))).toBeNull();
    });
  });

  it('follows the flag live, without a restart', async () => {
    const flags = new FakeFlags();
    const v = verifier(flags);
    const foreign = await token({ aud: 'another-app' });
    expect(await v.verify(foreign)).not.toBeNull();
    flags.enabled = true;
    expect(await v.verify(foreign)).toBeNull();
    flags.enabled = false;
    expect(await v.verify(foreign)).not.toBeNull();
  });

  describe('wiring (Nest injection, as AuthModule declares it)', () => {
    const env = { ...process.env };
    afterEach(() => {
      process.env = { ...env };
    });

    async function injected() {
      const moduleRef = await Test.createTestingModule({
        imports: [
          testConfigModule({
            AUTH_SERVICE_URL: origin,
            AUTH_CLIENT_ID: CLIENT_ID,
          }),
          FeatureFlagsModule,
        ],
        providers: [JwksAccessTokenVerifier],
      }).compile();
      return moduleRef.get(JwksAccessTokenVerifier);
    }

    it('is lenient by default: no flag, no pin', async () => {
      delete process.env.FEATURES_PIN_AUTH_VERIFY_TOKEN_CLAIMS;
      const v = await injected();
      expect(
        await v.verify(await token({ aud: 'another-app' })),
      ).not.toBeNull();
    });

    it('is strict with the emergency pin FEATURES_PIN_AUTH_VERIFY_TOKEN_CLAIMS=true', async () => {
      process.env.FEATURES_PIN_AUTH_VERIFY_TOKEN_CLAIMS = 'true';
      const v = await injected();
      expect(await v.verify(await token())).not.toBeNull();
      expect(await v.verify(await token({ aud: 'another-app' }))).toBeNull();
    });
  });
});

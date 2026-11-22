import {
  computeWebhookSignature,
  WebhookSignatureVerifier,
} from '../../domain/auth/webhook-signature';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { FakeClock } from '../../test-support/fake-clock';
import {
  AuthenticateLogoutWebhookUseCase,
  REQUIRE_SIGNATURE_FLAG,
} from './authenticate-logout-webhook.use-case';

const SIGNING_SECRET =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const LEGACY_SECRET = 'legacy-query-secret';
const BODY = '{"userId":"u1"}';
const ID = '3b241101-e2bb-4255-8caf-4136c566a962';
const NOW = '2023-11-14T22:13:20.000Z'; // 1700000000

class FakeFlags extends FeatureFlags {
  enabled = false;
  readonly asked: [string, boolean][] = [];
  async isEnabled(key: string, codeDefault: boolean): Promise<boolean> {
    this.asked.push([key, codeDefault]);
    return key === REQUIRE_SIGNATURE_FLAG ? this.enabled : codeDefault;
  }
}

describe('AuthenticateLogoutWebhookUseCase', () => {
  let flags: FakeFlags;
  let clock: FakeClock;
  let logs: { level: 'log' | 'warn'; message: string }[];

  beforeEach(() => {
    logs = [];
    flags = new FakeFlags();
    clock = FakeClock.at(NOW);
  });

  function useCase(
    options: { signingSecret?: string | null; legacySecret?: string } = {},
  ) {
    const signingSecret =
      options.signingSecret === undefined
        ? SIGNING_SECRET
        : options.signingSecret;
    return new AuthenticateLogoutWebhookUseCase(
      signingSecret ? new WebhookSignatureVerifier(signingSecret, clock) : null,
      options.legacySecret ?? LEGACY_SECRET,
      flags,
      clock,
      {
        log: (message: string) => logs.push({ level: 'log', message }),
        warn: (message: string) => logs.push({ level: 'warn', message }),
      },
    );
  }

  function signed(id = ID, secret = SIGNING_SECRET, body = BODY) {
    return {
      headers: {
        id,
        timestamp: '1700000000',
        signature: `v1=${computeWebhookSignature(secret, id, '1700000000', body)}`,
      },
      rawBody: Buffer.from(body),
    };
  }
  const randomId = (n: number) =>
    `00000000-0000-4000-8000-00000000000${n.toString()}`;
  const unsigned = { headers: {}, rawBody: Buffer.from(BODY) };

  describe(`${REQUIRE_SIGNATURE_FLAG} off (double acceptance)`, () => {
    it('accepts a valid signature, without ?secret=', async () => {
      expect(await useCase().execute({ ...signed() })).toBe(true);
    });

    it('accepts the legacy ?secret= without a signature', async () => {
      expect(
        await useCase().execute({ ...unsigned, querySecret: LEGACY_SECRET }),
      ).toBe(true);
    });

    it('accepts a valid signature even if ?secret= is wrong', async () => {
      expect(
        await useCase().execute({ ...signed(), querySecret: 'faux' }),
      ).toBe(true);
    });

    it('accepts the legacy ?secret= even if the signature is wrong', async () => {
      const forged = signed(ID, 'f'.repeat(64));
      expect(
        await useCase().execute({ ...forged, querySecret: LEGACY_SECRET }),
      ).toBe(true);
    });

    it('refuses without a valid signature or a correct ?secret=', async () => {
      const uc = useCase();
      expect(await uc.execute({ ...unsigned })).toBe(false);
      expect(await uc.execute({ ...unsigned, querySecret: 'faux' })).toBe(
        false,
      );
      expect(await uc.execute({ ...unsigned, querySecret: '' })).toBe(false);
      expect(
        await uc.execute({
          ...signed(ID, 'f'.repeat(64)),
          querySecret: 'faux',
        }),
      ).toBe(false);
    });

    it('compares ?secret= in full (prefix, suffix, case)', async () => {
      const uc = useCase();
      for (const guess of [
        LEGACY_SECRET.slice(0, -1),
        `${LEGACY_SECRET}x`,
        LEGACY_SECRET.toUpperCase(),
      ])
        expect(await uc.execute({ ...unsigned, querySecret: guess })).toBe(
          false,
        );
    });

    it('refuses the replay of a signed id, even with a valid ?secret=', async () => {
      const uc = useCase();
      expect(await uc.execute({ ...signed() })).toBe(true);
      expect(await uc.execute({ ...signed() })).toBe(false);
      expect(
        await uc.execute({ ...signed(), querySecret: LEGACY_SECRET }),
      ).toBe(false);
    });

    it('checks the seen id before the legacy fallback, without reading the flag', async () => {
      const uc = useCase();
      await uc.execute({ ...signed() });
      await uc.execute({ ...signed(), querySecret: LEGACY_SECRET });
      expect(flags.asked).toEqual([]);
    });

    it('refuses a replayed id sent alone (other headers missing) even with a valid ?secret=', async () => {
      const uc = useCase();
      await uc.execute({ ...signed() });
      expect(
        await uc.execute({
          headers: { id: ID },
          rawBody: Buffer.from(BODY),
          querySecret: LEGACY_SECRET,
        }),
      ).toBe(false);
      expect(flags.asked).toEqual([]);
    });

    it('does not record the id of a request that fell back to ?secret= (invalid signature)', async () => {
      const uc = useCase();
      const forged = signed(ID, 'f'.repeat(64));
      expect(await uc.execute({ ...forged, querySecret: LEGACY_SECRET })).toBe(
        true,
      );
      expect(await uc.execute({ ...signed() })).toBe(true);
    });

    it('accepts ?secret= when the headers are present but only partially filled (format)', async () => {
      expect(
        await useCase().execute({
          headers: { timestamp: '1700000000' },
          rawBody: Buffer.from(BODY),
          querySecret: LEGACY_SECRET,
        }),
      ).toBe(true);
      expect(logs.at(-1)?.message).toContain('(format)');
    });

    it('without a configured signing secret, only the legacy path exists', async () => {
      const uc = useCase({ signingSecret: null });
      expect(await uc.execute({ ...signed() })).toBe(false);
      expect(
        await uc.execute({ ...signed(), querySecret: LEGACY_SECRET }),
      ).toBe(true);
    });

    it('a missing or empty legacy secret lets nobody through', async () => {
      for (const legacySecret of ['', undefined as unknown as string]) {
        const uc = useCase({ legacySecret });
        expect(await uc.execute({ ...unsigned, querySecret: '' })).toBe(false);
        expect(await uc.execute({ ...unsigned })).toBe(false);
      }
    });

    it('reads the flag with false as the code default, and only if the signature does not suffice', async () => {
      const uc = useCase();
      await uc.execute({ ...signed() });
      expect(flags.asked).toEqual([]);
      await uc.execute({ ...unsigned, querySecret: LEGACY_SECRET });
      expect(flags.asked).toEqual([[REQUIRE_SIGNATURE_FLAG, false]]);
    });
  });

  describe(`${REQUIRE_SIGNATURE_FLAG} on (signature mandatory)`, () => {
    beforeEach(() => {
      flags.enabled = true;
    });

    it('accepts a valid signature', async () => {
      expect(await useCase().execute({ ...signed() })).toBe(true);
    });

    it('refuses the legacy ?secret= alone', async () => {
      expect(
        await useCase().execute({ ...unsigned, querySecret: LEGACY_SECRET }),
      ).toBe(false);
    });

    it('refuses a wrong signature even with the right ?secret=', async () => {
      expect(
        await useCase().execute({
          ...signed(ID, 'f'.repeat(64)),
          querySecret: LEGACY_SECRET,
        }),
      ).toBe(false);
    });

    it('refuses a replay, even with the right ?secret=', async () => {
      const uc = useCase();
      expect(await uc.execute({ ...signed() })).toBe(true);
      expect(
        await uc.execute({ ...signed(), querySecret: LEGACY_SECRET }),
      ).toBe(false);
    });

    it('without a configured signing secret, everything is refused (fail closed)', async () => {
      const uc = useCase({ signingSecret: null });
      expect(await uc.execute({ ...signed() })).toBe(false);
      expect(
        await uc.execute({ ...unsigned, querySecret: LEGACY_SECRET }),
      ).toBe(false);
    });
  });
  describe('logging of acceptances', () => {
    const FIVE_MIN_MS = 5 * 60_000;
    const warns = () => logs.filter((l) => l.level === 'warn');
    const infos = () => logs.filter((l) => l.level === 'log');
    const query = { querySecret: LEGACY_SECRET };

    /** One request per reason, each accepted through the legacy ?secret=. */
    const legacyCases: [
      string,
      (uc: AuthenticateLogoutWebhookUseCase) => Promise<boolean>,
    ][] = [
      ['no-signature-headers', (uc) => uc.execute({ ...unsigned, ...query })],
      [
        'format',
        (uc) =>
          uc.execute({
            headers: { id: ID, timestamp: 'nope', signature: 'v1=abc' },
            rawBody: Buffer.from(BODY),
            ...query,
          }),
      ],
      [
        'window',
        (uc) => {
          const stale = signed();
          stale.headers.timestamp = '1699999000';
          stale.headers.signature = `v1=${computeWebhookSignature(SIGNING_SECRET, ID, '1699999000', BODY)}`;
          return uc.execute({ ...stale, ...query });
        },
      ],
      ['hmac', (uc) => uc.execute({ ...signed(ID, 'f'.repeat(64)), ...query })],
      [
        'raw-body-unavailable',
        (uc) => uc.execute({ headers: signed().headers, ...query }),
      ],
    ];

    it.each(legacyCases)(
      'WARN with the reason %s on a legacy acceptance',
      async (reason, call) => {
        expect(await call(useCase())).toBe(true);
        expect(warns()).toHaveLength(1);
        expect(warns()[0].message).toContain('legacy ?secret=');
        expect(warns()[0].message).toContain(`(${reason})`);
        expect(infos()).toHaveLength(0);
      },
    );

    it('WARN missing-signing-secret when signed headers arrive without a configured secret', async () => {
      expect(
        await useCase({ signingSecret: null }).execute({
          ...signed(),
          ...query,
        }),
      ).toBe(true);
      expect(warns()).toHaveLength(1);
      expect(warns()[0].message).toContain('(missing-signing-secret)');
    });

    it('INFO on a signature acceptance, no WARN', async () => {
      await useCase().execute({ ...signed() });
      expect(infos()).toHaveLength(1);
      expect(infos()[0].message).toContain('signature');
      expect(warns()).toHaveLength(0);
    });

    it('writes nothing when the request is refused', async () => {
      const uc = useCase();
      await uc.execute({ ...unsigned, querySecret: 'faux' });
      await uc.execute({ ...signed(ID, 'f'.repeat(64)), querySecret: 'faux' });
      await uc.execute({ ...signed() });
      logs = [];
      await uc.execute({ ...signed(), ...query }); // replay
      expect(logs).toHaveLength(0);
    });

    it('throttles to one WARN per reason within 5 minutes, then logs again', async () => {
      const uc = useCase();
      await uc.execute({ ...unsigned, ...query });
      clock.set(new Date(Date.parse(NOW) + FIVE_MIN_MS - 1).toISOString());
      await uc.execute({ ...unsigned, ...query });
      expect(warns()).toHaveLength(1);
      clock.set(new Date(Date.parse(NOW) + FIVE_MIN_MS).toISOString());
      await uc.execute({ ...unsigned, ...query });
      expect(warns()).toHaveLength(2);
    });

    it('throttles the signature INFO line on its own key', async () => {
      const uc = useCase();
      await uc.execute({ ...signed(randomId(1)) });
      await uc.execute({ ...signed(randomId(2)) });
      expect(infos()).toHaveLength(1);
      clock.set(new Date(Date.parse(NOW) + FIVE_MIN_MS).toISOString());
      const id = randomId(3);
      const timestamp = '1700000300';
      await uc.execute({
        headers: {
          id,
          timestamp,
          signature: `v1=${computeWebhookSignature(SIGNING_SECRET, id, timestamp, BODY)}`,
        },
        rawBody: Buffer.from(BODY),
      });
      expect(infos()).toHaveLength(2);
    });

    it('keeps reasons (and INFO) independent of each other', async () => {
      const uc = useCase();
      await uc.execute({ ...unsigned, ...query });
      await uc.execute({ ...signed(ID, 'f'.repeat(64)), ...query });
      await uc.execute({ ...signed(randomId(9)) });
      expect(warns().map((l) => l.message)).toEqual([
        expect.stringContaining('(no-signature-headers)'),
        expect.stringContaining('(hmac)'),
      ]);
      expect(infos()).toHaveLength(1);
    });

    it('never writes the secrets, the signature or the id', async () => {
      const uc = useCase();
      const forged = signed(ID, 'f'.repeat(64));
      await uc.execute({ ...forged, ...query });
      await uc.execute({ ...unsigned, ...query });
      await uc.execute({ ...signed(randomId(5)) });
      const text = logs.map((l) => l.message).join('\n');
      for (const secret of [
        LEGACY_SECRET,
        SIGNING_SECRET,
        forged.headers.signature,
        forged.headers.signature.slice(3),
        ID,
        randomId(5),
      ])
        expect(text).not.toContain(secret);
    });
  });
});

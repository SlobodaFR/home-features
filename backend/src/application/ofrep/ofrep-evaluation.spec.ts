import { createHash } from 'crypto';
import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FlagValue } from '../../domain/feature-flag/flag-value';
import {
  bulkEtag,
  evaluationOf,
  ifNoneMatchSatisfied,
} from './ofrep-evaluation';

const flag = (key: string) =>
  FeatureFlag.create({
    id: `id-${key}`,
    appId: 'a1',
    key,
    name: key,
    description: null,
    clientExposed: false,
    lastEvaluatedAt: null,
    createdAt: new Date('2026-11-01T10:00:00Z'),
  });
const value = (key: string, enabled: boolean) =>
  FlagValue.create({
    id: `v-${key}`,
    flagId: `id-${key}`,
    environmentId: 'e1',
    enabled,
    updatedAt: new Date('2026-11-01T10:00:00Z'),
  });

describe('OFREP evaluation', () => {
  it('evaluates a defined value as STATIC with an on/off variant', () => {
    expect(evaluationOf(flag('a'), value('a', true))).toEqual({
      key: 'a',
      value: true,
      reason: 'STATIC',
      variant: 'on',
      metadata: {},
    });
    expect(evaluationOf(flag('a'), value('a', false))).toEqual({
      key: 'a',
      value: false,
      reason: 'STATIC',
      variant: 'off',
      metadata: {},
    });
  });

  // No value nor variant: the consumer's code default applies.
  it('evaluates a missing value as DISABLED without value nor variant', () => {
    const evaluation = evaluationOf(flag('a'), undefined);

    expect(evaluation).toEqual({ key: 'a', reason: 'DISABLED', metadata: {} });
    expect(evaluation).not.toHaveProperty('value');
    expect(evaluation).not.toHaveProperty('variant');
  });

  it('computes the strong ETag over the environment id and the sorted key=on|off|unset lines', () => {
    const etag = bulkEtag('e1', [
      { key: 'zeta', enabled: null },
      { key: 'alpha', enabled: true },
      { key: 'mid', enabled: false },
    ]);

    const expected = createHash('sha256')
      .update('e1\nalpha=on\nmid=off\nzeta=unset')
      .digest('base64url');
    expect(etag).toBe(`"${expected}"`);
  });

  it('changes the ETag with any value, key or environment change', () => {
    const base = bulkEtag('e1', [{ key: 'a', enabled: true }]);

    expect(bulkEtag('e1', [{ key: 'a', enabled: false }])).not.toBe(base);
    expect(bulkEtag('e1', [{ key: 'a', enabled: null }])).not.toBe(base);
    expect(bulkEtag('e1', [{ key: 'b', enabled: true }])).not.toBe(base);
    expect(bulkEtag('e2', [{ key: 'a', enabled: true }])).not.toBe(base);
    expect(bulkEtag('e1', [])).toBe(
      `"${createHash('sha256').update('e1\n').digest('base64url')}"`,
    );
  });

  describe('If-None-Match', () => {
    const etag = '"abc"';

    it.each([
      ['the same strong tag', '"abc"'],
      ['the weak form', 'W/"abc"'],
      ['a list containing it', '"zzz", W/"abc" ,"yyy"'],
      ['a wildcard', '*'],
    ])('is satisfied by %s', (_label, header) => {
      expect(ifNoneMatchSatisfied(header, etag)).toBe(true);
    });

    it.each([
      ['no header', undefined],
      ['another tag', '"abd"'],
      ['an unquoted tag', 'abc'],
      ['an empty header', ''],
    ])('is not satisfied by %s', (_label, header) => {
      expect(ifNoneMatchSatisfied(header, etag)).toBe(false);
    });
  });
});

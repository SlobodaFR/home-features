import { createHash } from 'crypto';
import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FlagValue } from '../../domain/feature-flag/flag-value';

/** OFREP 0.4.0 success item. Booleans only; no targeting, so the reason is STATIC. */
export type OfrepEvaluation =
  | {
      key: string;
      value: boolean;
      reason: 'STATIC';
      variant: 'on' | 'off';
      metadata: Record<string, never>;
    }
  /** No value in the environment: no value nor variant, so the consumer's code default applies. */
  | { key: string; reason: 'DISABLED'; metadata: Record<string, never> };

export function evaluationOf(
  flag: FeatureFlag,
  value: FlagValue | undefined,
): OfrepEvaluation {
  if (!value) {
    return { key: flag.key, reason: 'DISABLED', metadata: {} };
  }
  return {
    key: flag.key,
    value: value.enabled,
    reason: 'STATIC',
    variant: value.enabled ? 'on' : 'off',
    metadata: {},
  };
}

/**
 * Strong ETag of a bulk evaluation: base64url(sha256(environment id + "\n" + the sorted lines
 * "key=on|off|unset" joined by "\n")), quoted. Anything that changes a response changes it.
 */
export function bulkEtag(
  environmentId: string,
  flags: { key: string; enabled: boolean | null }[],
): string {
  const lines = flags
    .map(({ key, enabled }) => {
      const state = enabled === null ? 'unset' : enabled ? 'on' : 'off';
      return `${key}=${state}`;
    })
    .toSorted();
  const digest = createHash('sha256')
    .update(`${environmentId}\n${lines.join('\n')}`)
    .digest('base64url');
  return `"${digest}"`;
}

/**
 * If-None-Match uses the weak comparison (RFC 9110 §13.1.2): `W/` is ignored, the header may list
 * several tags, `*` matches any current representation.
 */
export function ifNoneMatchSatisfied(
  header: string | undefined,
  etag: string,
): boolean {
  if (!header) {
    return false;
  }
  if (header.trim() === '*') {
    return true;
  }
  return header
    .split(',')
    .map((tag) => tag.trim().replace(/^W\//, ''))
    .some((tag) => tag === etag);
}

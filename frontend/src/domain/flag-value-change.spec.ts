import { describe, expect, it } from 'vitest';
import { describeChange, FlagValueChange } from './flag-value-change';

const change: FlagValueChange = {
  id: 'c1',
  environmentId: 'e1',
  oldEnabled: null,
  newEnabled: true,
  actor: 'Alice',
  source: 'ui',
  at: '2026-11-21T10:00:00Z',
};
const environments = [{ id: 'e1', name: 'Production' }];

describe('flag-value-change', () => {
  it('describes a change from unset to on by a UI user', () => {
    expect(describeChange(change, environments)).toBe(
      'Production: unset → on, by Alice (ui)',
    );
  });

  it('describes a CLI change of a deleted environment', () => {
    expect(
      describeChange(
        {
          ...change,
          environmentId: 'gone',
          oldEnabled: true,
          newEnabled: false,
          source: 'cli',
          actor: 'ops',
        },
        environments,
      ),
    ).toBe('Deleted environment: on → off, by ops (cli)');
  });
});

import { describe, expect, it } from 'vitest';
import {
  deletionWarning,
  enabledEnvironmentNames,
  FeatureFlagWithValues,
  filterFlags,
  withFlagValue,
} from './feature-flag';

const flag: FeatureFlagWithValues = {
  id: 'f1',
  appId: 'a1',
  key: 'new-checkout',
  name: 'New checkout',
  description: null,
  clientExposed: false,
  lastEvaluatedAt: null,
  createdAt: '2026-11-01T10:00:00Z',
  values: [
    { environmentId: 'e1', enabled: true, updatedAt: '2026-11-01T10:00:00Z' },
    { environmentId: 'e2', enabled: false, updatedAt: '2026-11-01T10:00:00Z' },
  ],
};
const environments = [
  { id: 'e1', name: 'Production' },
  { id: 'e2', name: 'Staging' },
];

describe('feature-flag', () => {
  it('lists the environments where the flag is on', () => {
    expect(enabledEnvironmentNames(flag, environments)).toEqual(['Production']);
    expect(
      enabledEnvironmentNames({ ...flag, values: [] }, environments),
    ).toEqual([]);
  });

  it('warns about the consequence of deleting a flag that is on, naming the key to type', () => {
    const warning = deletionWarning(flag, environments);

    expect(warning).toContain('Production');
    expect(warning).toContain('new-checkout');
    expect(warning).toMatch(/code default/);
    expect(warning).toMatch(/never evaluated/i);
  });

  it('shows the last evaluation in the warning', () => {
    expect(
      deletionWarning(
        { ...flag, lastEvaluatedAt: '2026-11-20T08:00:00Z' },
        environments,
      ),
    ).toMatch(/last evaluated/i);
  });

  it('needs no warning for a flag that is off everywhere', () => {
    expect(
      deletionWarning({ ...flag, values: [flag.values[1]] }, environments),
    ).toBeNull();
  });
});

describe('filterFlags', () => {
  const other: FeatureFlagWithValues = {
    ...flag,
    id: 'f2',
    key: 'dark-mode',
    name: 'Dark mode',
    clientExposed: true,
    lastEvaluatedAt: '2026-11-02T10:00:00Z',
  };

  it('searches name and key, case-insensitively', () => {
    expect(filterFlags([flag, other], 'CHECK', 'all')).toEqual([flag]);
    expect(filterFlags([flag, other], 'dark-', 'all')).toEqual([other]);
  });

  it('narrows by attribute', () => {
    expect(filterFlags([flag, other], '', 'client')).toEqual([other]);
    expect(filterFlags([flag, other], '', 'never-evaluated')).toEqual([flag]);
  });
});

describe('withFlagValue', () => {
  it('updates an existing value and adds a missing one', () => {
    const updated = withFlagValue(flag, 'e2', true, '2026-11-26T00:00:00Z');
    expect(updated.values.find((v) => v.environmentId === 'e2')?.enabled).toBe(
      true,
    );
    const added = withFlagValue(flag, 'e3', true, '2026-11-26T00:00:00Z');
    expect(added.values).toHaveLength(3);
  });
});

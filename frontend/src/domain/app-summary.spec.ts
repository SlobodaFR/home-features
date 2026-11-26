import { describe, expect, it } from 'vitest';
import { pluralize, summarizeOverview } from './app-summary';
import { AppOverview } from './overview';
import { ConfigValueType } from './config-entry';

const base = { id: 'a', appId: 'a', name: 'n', description: null };

describe('summarizeOverview', () => {
  it('counts entities and finds the latest change', () => {
    const overview = {
      app: { id: 'a', name: 'A', slug: 'a', description: null, createdAt: '' },
      environments: [{ id: 'e' }, { id: 'f' }],
      flags: [
        {
          ...base,
          key: 'k',
          clientExposed: false,
          lastEvaluatedAt: null,
          createdAt: '',
          values: [
            {
              environmentId: 'e',
              enabled: true,
              updatedAt: '2026-01-02T00:00:00Z',
            },
          ],
        },
      ],
      configs: [
        {
          ...base,
          key: 'c',
          type: ConfigValueType.STRING,
          createdAt: '',
          values: [
            {
              environmentId: 'e',
              value: 'x',
              updatedAt: '2026-03-01T00:00:00Z',
            },
          ],
        },
      ],
    } as unknown as AppOverview;
    expect(summarizeOverview(overview)).toEqual({
      environmentCount: 2,
      flagCount: 1,
      configCount: 1,
      lastChangeAt: '2026-03-01T00:00:00Z',
    });
  });

  it('has no last change for an empty app', () => {
    const overview = {
      environments: [],
      flags: [],
      configs: [],
    } as unknown as AppOverview;
    expect(summarizeOverview(overview).lastChangeAt).toBeNull();
  });
});

describe('pluralize', () => {
  it('handles one and many', () => {
    expect(pluralize(1, 'flag')).toBe('1 flag');
    expect(pluralize(3, 'flag')).toBe('3 flags');
  });
});

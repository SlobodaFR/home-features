import { FlagValueChange, FlagValueChangeProps } from './flag-value-change';

const props: FlagValueChangeProps = {
  id: 'c1',
  flagId: 'f1',
  environmentId: 'e1',
  oldEnabled: null,
  newEnabled: true,
  actor: 'Alice',
  source: 'ui',
  at: new Date('2026-11-21T10:00:00Z'),
};

describe('FlagValueChange', () => {
  it('records a change from unset to on', () => {
    const change = FlagValueChange.create(props);

    expect(change.oldEnabled).toBeNull();
    expect(change.newEnabled).toBe(true);
    expect(change.source).toBe('ui');
  });

  it('accepts the cli source', () => {
    expect(FlagValueChange.create({ ...props, source: 'cli' }).source).toBe(
      'cli',
    );
  });

  it('refuses another source', () => {
    expect(() =>
      FlagValueChange.create({ ...props, source: 'api' as 'ui' }),
    ).toThrow('Flag value change source must be "ui" or "cli"');
  });

  it('refuses an anonymous change', () => {
    expect(() => FlagValueChange.create({ ...props, actor: '  ' })).toThrow(
      'Flag value change actor must not be empty',
    );
  });
});

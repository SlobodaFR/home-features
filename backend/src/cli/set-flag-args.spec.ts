import { parseSetFlagArgs } from './set-flag-args';

describe('parseSetFlagArgs', () => {
  const base = ['--app', 'budget', '--env', 'production', '--flag', 'new-ui'];

  it('reads the app, environment, flag and value, actor defaulting to "cli"', () => {
    expect(parseSetFlagArgs([...base, '--enabled', 'true'])).toEqual({
      ok: true,
      args: {
        app: 'budget',
        env: 'production',
        flag: 'new-ui',
        enabled: true,
        actor: 'cli',
      },
    });
    expect(
      parseSetFlagArgs([...base, '--enabled', 'false', '--actor', 'thomas']),
    ).toMatchObject({ ok: true, args: { enabled: false, actor: 'thomas' } });
  });

  it.each([
    ['a missing --enabled', base],
    ['a non-boolean --enabled', [...base, '--enabled', 'yes']],
    ['a missing --flag', ['--app', 'a', '--env', 'e', '--enabled', 'true']],
    ['an empty --actor', [...base, '--enabled', 'true', '--actor', ' ']],
    ['an unknown option', [...base, '--enabled', 'true', '--force']],
    ['a positional argument', [...base, '--enabled', 'true', 'extra']],
  ])('refuses %s with the usage', (_label, argv) => {
    const result = parseSetFlagArgs(argv);

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.error).toMatch(
      /Usage: node dist\/cli\/set-flag\.js/,
    );
  });
});

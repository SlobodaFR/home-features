import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { INestApplicationContext } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { pseudonymize } from '../domain/shared/pseudonymize';
import { ENTITIES } from '../infrastructure/persistence/entities';
import { MIGRATIONS } from '../infrastructure/persistence/migrations';
import { testConfigModule } from '../test-support/test-config.module';
import { SetFlagFromCliUseCase } from '../application/feature-flag/set-flag-from-cli.use-case';
import { CliModule } from './cli.module';
import { runSetFlag } from './run-set-flag';

const SECRET = 'cli-test-pseudonym-secret-0123456789abcdef';

describe('set-flag CLI', () => {
  let context: INestApplicationContext;
  let dataSource: DataSource;
  let output: string[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        testConfigModule({ PSEUDONYM_SECRET: SECRET }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: ENTITIES,
          migrations: MIGRATIONS,
          migrationsRun: true,
        }),
        CliModule,
      ],
    }).compile();
    context = moduleRef;
    dataSource = moduleRef.get(DataSource);
    const at = "'2026-11-01 10:00:00'";
    await dataSource.query(
      `INSERT INTO apps (id, user_id, name, slug, description, created_at) VALUES ('a1', 'u1', 'Budget', 'budget', NULL, ${at}), ('a2', 'u1', 'Shared one', 'shared', NULL, ${at}), ('a3', 'u2', 'Shared two', 'shared', NULL, ${at})`,
    );
    await dataSource.query(
      `INSERT INTO environments (id, app_id, name, slug, "order", created_at) VALUES ('e1', 'a1', 'Production', 'production', 0, ${at})`,
    );
    await dataSource.query(
      `INSERT INTO feature_flags (id, app_id, key, name, description, created_at) VALUES ('f1', 'a1', 'new-ui', 'New UI', NULL, ${at})`,
    );
  });

  beforeEach(() => {
    output = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const run = (argv: string[]) =>
    runSetFlag(argv, context, (line) => output.push(line));
  const args = (enabled: string, ...extra: string[]) => [
    '--app',
    'budget',
    '--env',
    'production',
    '--flag',
    'new-ui',
    '--enabled',
    enabled,
    ...extra,
  ];

  it('sets the value and journals it with source cli and the actor', async () => {
    expect(await run(args('true', '--actor', 'thomas'))).toBe(0);

    expect(
      await dataSource.query(
        "SELECT enabled FROM flag_values WHERE flag_id = 'f1' AND environment_id = 'e1'",
      ),
    ).toEqual([{ enabled: 1 }]);
    expect(
      await dataSource.query(
        "SELECT old_enabled, new_enabled, actor, source FROM flag_value_changes WHERE flag_id = 'f1'",
      ),
    ).toEqual([
      { old_enabled: null, new_enabled: 1, actor: 'thomas', source: 'cli' },
    ]);
    expect(output.join('\n')).toContain(
      'budget/production new-ui: unset -> on',
    );
  });

  it('logs the change with a pseudonymous cli actor', async () => {
    const log = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    expect(await run(args('false', '--actor', 'ops'))).toBe(0);

    const line = log.mock.calls
      .map(([entry]) => entry as Record<string, unknown>)
      .find((entry) => entry.event === 'flag_value_changed');
    expect(line).toMatchObject({
      source: 'cli',
      newEnabled: false,
      actorRef: pseudonymize('cli:ops', SECRET),
    });
    expect(JSON.stringify(line)).not.toContain('ops"');
  });

  it('says so and writes nothing when the value is already set', async () => {
    await run(args('true'));
    const before: unknown[] = await dataSource.query(
      'SELECT id FROM flag_value_changes',
    );

    expect(await run(args('true'))).toBe(0);

    expect(output.join('\n')).toContain('already on');
    expect(
      await dataSource.query('SELECT id FROM flag_value_changes'),
    ).toHaveLength(before.length);
  });

  it('refuses an ambiguous app slug', async () => {
    const code = await run([
      '--app',
      'shared',
      '--env',
      'production',
      '--flag',
      'new-ui',
      '--enabled',
      'true',
    ]);

    expect(code).toBe(1);
    expect(output.join('\n')).toMatch(/ambiguous: 2 apps/);
  });

  it.each([
    [
      'an unknown app',
      ['--app', 'nope', '--env', 'production', '--flag', 'new-ui'],
    ],
    [
      'an unknown environment',
      ['--app', 'budget', '--env', 'nope', '--flag', 'new-ui'],
    ],
    [
      'an unknown flag',
      ['--app', 'budget', '--env', 'production', '--flag', 'nope'],
    ],
  ])('refuses %s', async (_label, argv) => {
    expect(await run([...argv, '--enabled', 'true'])).toBe(1);
    expect(output.join('\n')).toMatch(/not found/);
  });

  it('answers 3 when the tool itself fails', async () => {
    vi.spyOn(context.get(SetFlagFromCliUseCase), 'execute').mockRejectedValue(
      new Error('database is locked'),
    );

    const errors: string[] = [];

    expect(
      await runSetFlag(
        args('true'),
        context,
        (line) => output.push(line),
        (line) => errors.push(line),
      ),
    ).toBe(3);
    expect(errors).toEqual(['set-flag failed: database is locked']);
    expect(output).toEqual([]);
  });

  it('ignores spaces around the slugs', async () => {
    expect(
      await run([
        '--app',
        ' budget ',
        '--env',
        'production ',
        '--flag',
        ' new-ui',
        '--enabled',
        'true',
      ]),
    ).toBe(0);
  });

  it('answers 2 with the usage on bad arguments', async () => {
    expect(await run(['--app', 'budget'])).toBe(2);
    expect(output.join('\n')).toMatch(/Usage:/);
  });
});

import { serializedTypeOrmRoot } from '../../test-support/serialized-typeorm';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { pseudonymize } from '../../domain/shared/pseudonymize';
import { ENTITIES } from '../../infrastructure/persistence/entities';
import { MIGRATIONS } from '../../infrastructure/persistence/migrations';
import { testConfigModule } from '../../test-support/test-config.module';
import { AppEnvironmentsController } from './controllers/app-environments.controller';
import { AppFlagsController } from './controllers/app-flags.controller';
import { AppsController } from './controllers/apps.controller';
import { FlagsController } from './controllers/flags.controller';
import { FeatureFlagModule } from './modules/feature-flag.module';

const SECRET = 'audit-test-pseudonym-secret-0123456789abcdef';
const USER = { id: 'user-1', email: 'alice@example.com', name: 'Alice Martin' };
const OTHER_USER = { id: 'user-2', email: 'bob@example.com', name: 'Bob' };

describe('Flag value audit journal (integration)', () => {
  let appsController: AppsController;
  let appEnvironmentsController: AppEnvironmentsController;
  let appFlagsController: AppFlagsController;
  let flagsController: FlagsController;
  let dataSource: DataSource;
  let counter = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        testConfigModule({ PSEUDONYM_SECRET: SECRET }),
        serializedTypeOrmRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: ENTITIES,
          migrations: MIGRATIONS,
          migrationsRun: true,
        }),
        FeatureFlagModule,
      ],
    }).compile();
    appsController = moduleRef.get(AppsController);
    appEnvironmentsController = moduleRef.get(AppEnvironmentsController);
    appFlagsController = moduleRef.get(AppFlagsController);
    flagsController = moduleRef.get(FlagsController);
    dataSource = moduleRef.get(DataSource);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setup() {
    counter += 1;
    const app = await appsController.create(
      { name: `App ${counter}`, slug: `app-${counter}`, description: null },
      USER,
    );
    const production = await appEnvironmentsController.create(
      app.id,
      { name: 'Production', slug: 'production' },
      USER,
    );
    const flag = await appFlagsController.create(
      app.id,
      { key: 'new-checkout', name: 'New checkout', description: null },
      USER,
    );
    return { app, production, flag };
  }

  it('journals every value change, oldest value first unset, newest first in the history', async () => {
    const { production, flag } = await setup();

    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: true },
      USER,
    );
    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: false },
      USER,
    );

    const history = await flagsController.history(flag.id, USER);
    expect(history).toEqual([
      expect.objectContaining({
        environmentId: production.id,
        oldEnabled: true,
        newEnabled: false,
        actor: 'Alice Martin',
        source: 'ui',
      }),
      expect.objectContaining({
        environmentId: production.id,
        oldEnabled: null,
        newEnabled: true,
        actor: 'Alice Martin',
        source: 'ui',
      }),
    ]);
    expect(typeof history[0].at).toBe('string');
  });

  it('journals nothing when the value does not change', async () => {
    const { production, flag } = await setup();
    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: true },
      USER,
    );

    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: true },
      USER,
    );

    expect(await flagsController.history(flag.id, USER)).toHaveLength(1);
  });

  it('writes one structured log line per change, with a pseudonymous actor only', async () => {
    const { production, flag } = await setup();
    const log = vi.spyOn(Logger.prototype, 'log');

    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: true },
      USER,
    );

    const lines = log.mock.calls
      .map(([line]) => line as Record<string, unknown>)
      .filter(
        (line) =>
          typeof line === 'object' && line.event === 'flag_value_changed',
      );
    expect(lines).toEqual([
      {
        msg: 'flag value changed',
        event: 'flag_value_changed',
        flagId: flag.id,
        flagKey: 'new-checkout',
        environmentId: production.id,
        oldEnabled: null,
        newEnabled: true,
        source: 'ui',
        actorRef: pseudonymize(USER.id, SECRET),
      },
    ]);
    expect(JSON.stringify(lines)).not.toMatch(/Alice|alice@example\.com/);
  });

  it('keeps the value unchanged when the journal cannot be written (same transaction)', async () => {
    const { production, flag } = await setup();
    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: true },
      USER,
    );
    await dataSource.query(
      "CREATE TRIGGER fail_journal BEFORE INSERT ON flag_value_changes BEGIN SELECT RAISE(ABORT, 'journal down'); END",
    );

    await expect(
      flagsController.setValue(
        flag.id,
        production.id,
        { enabled: false },
        USER,
      ),
    ).rejects.toThrow('journal down');

    await dataSource.query('DROP TRIGGER fail_journal');
    const rows: { enabled: number }[] = await dataSource.query(
      'SELECT enabled FROM flag_values WHERE flag_id = ?',
      [flag.id],
    );
    expect(rows).toEqual([{ enabled: 1 }]);
  });

  // The shared better-sqlite3 runner must not let one failing transaction swallow another.
  it('rolls back each of two concurrent changes when the journal cannot be written', async () => {
    const { app, production, flag } = await setup();
    const second = await appFlagsController.create(
      app.id,
      { key: 'second', name: 'Second', description: null },
      USER,
    );
    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: true },
      USER,
    );
    await flagsController.setValue(
      second.id,
      production.id,
      { enabled: true },
      USER,
    );
    await dataSource.query(
      "CREATE TRIGGER fail_journal BEFORE INSERT ON flag_value_changes BEGIN SELECT RAISE(ABORT, 'journal down'); END",
    );

    const results = await Promise.allSettled([
      flagsController.setValue(
        flag.id,
        production.id,
        { enabled: false },
        USER,
      ),
      flagsController.setValue(
        second.id,
        production.id,
        { enabled: false },
        USER,
      ),
    ]);

    await dataSource.query('DROP TRIGGER fail_journal');
    expect(results.map((result) => result.status)).toEqual([
      'rejected',
      'rejected',
    ]);
    const rows: { enabled: number }[] = await dataSource.query(
      'SELECT enabled FROM flag_values WHERE flag_id IN (?, ?)',
      [flag.id, second.id],
    );
    expect(rows).toEqual([{ enabled: 1 }, { enabled: 1 }]);
    const journal: unknown[] = await dataSource.query(
      'SELECT id FROM flag_value_changes WHERE flag_id IN (?, ?)',
      [flag.id, second.id],
    );
    expect(journal).toHaveLength(2);
  });

  // Never nested in (and rolled back with) a transaction another request left open.
  it('waits for a transaction already open on the shared connection', async () => {
    const { production, flag } = await setup();
    const runner = dataSource.createQueryRunner();
    await runner.startTransaction();

    const pending = flagsController.setValue(
      flag.id,
      production.id,
      { enabled: true },
      USER,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    await runner.rollbackTransaction();
    await runner.release();
    await pending;

    const rows: { enabled: number }[] = await dataSource.query(
      'SELECT enabled FROM flag_values WHERE flag_id = ?',
      [flag.id],
    );
    expect(rows).toEqual([{ enabled: 1 }]);
    expect(await flagsController.history(flag.id, USER)).toHaveLength(1);
  });

  it('is append-only', async () => {
    const { production, flag } = await setup();
    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: true },
      USER,
    );

    await expect(
      dataSource.query('UPDATE flag_value_changes SET new_enabled = 0'),
    ).rejects.toThrow(/append-only/);
    await expect(
      dataSource.query('DELETE FROM flag_value_changes'),
    ).rejects.toThrow(/append-only/);
  });

  it('keeps the history of a deleted flag', async () => {
    const { production, flag } = await setup();
    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: false },
      USER,
    );

    await flagsController.remove(flag.id, {}, USER);

    const rows: unknown[] = await dataSource.query(
      'SELECT id FROM flag_value_changes WHERE flag_id = ?',
      [flag.id],
    );
    expect(rows).toHaveLength(1);
  });

  it('shows the history only to the owner', async () => {
    const { flag } = await setup();

    await expect(flagsController.history(flag.id, OTHER_USER)).rejects.toThrow(
      /not found/,
    );
  });
});

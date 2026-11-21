import { DataSource } from 'typeorm';
import { ENTITIES } from '../entities';
import { FlagValueChangeOrmEntity } from '../entities/flag-value-change.orm-entity';
import { MIGRATIONS } from '../migrations';
import { TypeOrmFlagValueChangeRepository } from './typeorm-flag-value-change.repository';

describe('TypeOrmFlagValueChangeRepository', () => {
  let ds: DataSource;
  let repository: TypeOrmFlagValueChangeRepository;

  beforeEach(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: ENTITIES,
      migrations: MIGRATIONS,
      migrationsRun: true,
    });
    await ds.initialize();
    repository = new TypeOrmFlagValueChangeRepository(
      ds.getRepository(FlagValueChangeOrmEntity),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  const insert = (id: string, at: string, flagId = 'f1') =>
    ds.query(
      "INSERT INTO flag_value_changes (id, flag_id, environment_id, old_enabled, new_enabled, actor, source, at) VALUES (?, ?, 'e1', NULL, 1, 'Alice', 'ui', ?)",
      [id, flagId, at],
    );

  it('returns the newest first, insertion order breaking ties', async () => {
    await insert('z-first', '2026-11-21 10:00:00.000');
    await insert('a-second', '2026-11-21 10:00:00.000');
    await insert('m-older', '2026-11-20 10:00:00.000');
    await insert('other', '2026-11-22 10:00:00.000', 'f2');

    const changes = await repository.findLatestByFlagId('f1', 10);

    expect(changes.map((change) => change.id)).toEqual([
      'a-second',
      'z-first',
      'm-older',
    ]);
  });

  it('caps the result', async () => {
    await insert('c1', '2026-11-21 10:00:00.000');
    await insert('c2', '2026-11-21 11:00:00.000');

    expect(
      (await repository.findLatestByFlagId('f1', 1)).map((c) => c.id),
    ).toEqual(['c2']);
  });
});

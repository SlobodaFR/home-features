import { DataSource } from 'typeorm';
import { FeatureFlag } from '../../../domain/feature-flag/feature-flag';
import { ENTITIES } from '../entities';
import { FeatureFlagOrmEntity } from '../entities/feature-flag.orm-entity';
import { MIGRATIONS } from '../migrations';
import { TypeOrmFeatureFlagRepository } from './typeorm-feature-flag.repository';

describe('TypeOrmFeatureFlagRepository', () => {
  let ds: DataSource;
  let repository: TypeOrmFeatureFlagRepository;
  const flag = FeatureFlag.create({
    id: 'f1',
    appId: 'a1',
    key: 'new-ui',
    name: 'New UI',
    description: null,
    clientExposed: true,
    lastEvaluatedAt: null,
    createdAt: new Date('2026-11-01T10:00:00Z'),
  });

  beforeEach(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: ENTITIES,
      migrations: MIGRATIONS,
      migrationsRun: true,
    });
    await ds.initialize();
    await ds.query(
      "INSERT INTO apps (id, user_id, name, slug, description, created_at) VALUES ('a1', 'u1', 'Budget', 'budget', NULL, '2026-11-01 10:00:00')",
    );
    repository = new TypeOrmFeatureFlagRepository(
      ds.getRepository(FeatureFlagOrmEntity),
    );
    await repository.save(flag);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('round-trips the exposure', async () => {
    expect((await repository.findById('f1'))?.clientExposed).toBe(true);
  });

  it('touches last_evaluated_at only', async () => {
    const at = new Date('2026-11-21T10:00:00Z');

    await repository.touchLastEvaluatedAt(['f1'], at);

    const reloaded = await repository.findById('f1');
    expect(reloaded?.lastEvaluatedAt).toEqual(at);
    expect(reloaded?.name).toBe('New UI');
    expect(reloaded?.clientExposed).toBe(true);
  });

  it('does nothing for an empty list', async () => {
    await expect(
      repository.touchLastEvaluatedAt([], new Date()),
    ).resolves.toBeUndefined();
  });

  it('never overwrites last_evaluated_at on save', async () => {
    const at = new Date('2026-11-21T10:00:00Z');
    await repository.touchLastEvaluatedAt(['f1'], at);

    await repository.save(flag.withDetails({ name: 'Renamed' }));

    expect((await repository.findById('f1'))?.lastEvaluatedAt).toEqual(at);
  });
});

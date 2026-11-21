import { App } from '../../domain/app/app';
import { AppRepository } from '../../domain/app/app.repository';
import { Environment } from '../../domain/environment/environment';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { FlagValue } from '../../domain/feature-flag/flag-value';
import { FlagValueChange } from '../../domain/feature-flag/flag-value-change';
import {
  FlagValueChangeAuthor,
  FlagValueRepository,
  RecordedFlagValue,
} from '../../domain/feature-flag/flag-value.repository';
import { ChangeFlagValueService } from './change-flag-value.service';
import { FlagAuditLog } from './flag-audit-log';
import { SetFlagValueUseCase } from './set-flag-value.use-case';

class InMemoryAppRepository extends AppRepository {
  constructor(private readonly apps: App[]) {
    super();
  }
  async findAll(): Promise<App[]> {
    return this.apps;
  }
  async findById(id: string): Promise<App | null> {
    return this.apps.find((a) => a.id === id) ?? null;
  }
  async findAllBySlug(): Promise<App[]> {
    return [];
  }
  async findByNameOrSlug(): Promise<App | null> {
    return null;
  }
  async save(): Promise<void> {}
  async delete(): Promise<void> {}
}

class InMemoryEnvironmentRepository extends EnvironmentRepository {
  constructor(private readonly environments: Environment[]) {
    super();
  }
  async findAllByAppId(appId: string): Promise<Environment[]> {
    return this.environments.filter((e) => e.appId === appId);
  }
  async findById(id: string): Promise<Environment | null> {
    return this.environments.find((e) => e.id === id) ?? null;
  }
  async findBySlug(): Promise<Environment | null> {
    return null;
  }
  async save(): Promise<void> {}
  async saveAll(): Promise<void> {}
  async delete(): Promise<void> {}
}

class InMemoryFeatureFlagRepository extends FeatureFlagRepository {
  constructor(private readonly flags: FeatureFlag[]) {
    super();
  }
  async findAllByAppId(appId: string): Promise<FeatureFlag[]> {
    return this.flags.filter((f) => f.appId === appId);
  }
  async findById(id: string): Promise<FeatureFlag | null> {
    return this.flags.find((f) => f.id === id) ?? null;
  }
  async findByKey(): Promise<FeatureFlag | null> {
    return null;
  }
  async save(): Promise<void> {}
  async touchLastEvaluatedAt(): Promise<void> {}
  async delete(): Promise<void> {}
}

class InMemoryFlagValueRepository extends FlagValueRepository {
  values: FlagValue[] = [];

  async findAllByFlagId(flagId: string): Promise<FlagValue[]> {
    return this.values.filter((v) => v.flagId === flagId);
  }
  async findAllByAppId(): Promise<FlagValue[]> {
    return this.values;
  }
  async findOne(
    flagId: string,
    environmentId: string,
  ): Promise<FlagValue | null> {
    return (
      this.values.find(
        (v) => v.flagId === flagId && v.environmentId === environmentId,
      ) ?? null
    );
  }
  private replace(flagValue: FlagValue): void {
    this.values = this.values.filter(
      (v) =>
        !(
          v.flagId === flagValue.flagId &&
          v.environmentId === flagValue.environmentId
        ),
    );
    this.values.push(flagValue);
  }
  async upsertRecordingChange(
    flagValue: FlagValue,
    author: FlagValueChangeAuthor,
  ): Promise<RecordedFlagValue> {
    const existing = await this.findOne(
      flagValue.flagId,
      flagValue.environmentId,
    );
    if (existing?.enabled === flagValue.enabled) {
      return { value: existing, change: null };
    }
    this.replace(flagValue);
    const change = FlagValueChange.create({
      id: `c${this.changes.length}`,
      flagId: flagValue.flagId,
      environmentId: flagValue.environmentId,
      oldEnabled: existing ? existing.enabled : null,
      newEnabled: flagValue.enabled,
      actor: author.actor,
      source: author.source,
      at: flagValue.updatedAt,
    });
    this.changes.push(change);
    return { value: flagValue, change };
  }
  changes: FlagValueChange[] = [];
  async deleteByFlagId(): Promise<void> {}
  async deleteByEnvironmentId(): Promise<void> {}
}

class RecordingAuditLog extends FlagAuditLog {
  lines: { change: FlagValueChange; identity: string }[] = [];
  valueChanged(_flag: FeatureFlag, change: FlagValueChange, identity: string) {
    this.lines.push({ change, identity });
  }
}

const APP = App.create({
  id: 'app-1',
  userId: 'user-1',
  name: 'E-commerce Core',
  slug: 'ecommerce-core',
  description: null,
  createdAt: new Date('2026-01-01'),
});

const ENV = Environment.create({
  id: 'env-1',
  appId: 'app-1',
  name: 'Production',
  slug: 'production',
  order: 0,
  createdAt: new Date('2026-01-01'),
});

const FLAG = FeatureFlag.create({
  id: 'flag-1',
  appId: 'app-1',
  key: 'new-checkout-flow',
  name: 'New checkout flow',
  description: null,
  clientExposed: false,
  lastEvaluatedAt: null,
  createdAt: new Date('2026-01-01'),
});

function buildUseCase() {
  const appRepository = new InMemoryAppRepository([APP]);
  const environmentRepository = new InMemoryEnvironmentRepository([ENV]);
  const flagRepository = new InMemoryFeatureFlagRepository([FLAG]);
  const flagValueRepository = new InMemoryFlagValueRepository();
  const auditLog = new RecordingAuditLog();

  return {
    useCase: new SetFlagValueUseCase(
      appRepository,
      flagRepository,
      environmentRepository,
      new ChangeFlagValueService(flagValueRepository, auditLog),
    ),
    flagValueRepository,
    auditLog,
  };
}

const USER = { id: 'user-1', name: 'Alice' };

describe('SetFlagValueUseCase', () => {
  it('creates a flag value when none exists', async () => {
    const { useCase, flagValueRepository } = buildUseCase();

    const dto = await useCase.execute('flag-1', 'env-1', true, USER);

    expect(dto.enabled).toBe(true);
    expect(dto.environmentId).toBe('env-1');
    expect(flagValueRepository.values).toHaveLength(1);
  });

  it('upserts (updates) an existing flag value', async () => {
    const { useCase, flagValueRepository } = buildUseCase();

    await useCase.execute('flag-1', 'env-1', true, USER);
    const dto = await useCase.execute('flag-1', 'env-1', false, USER);

    expect(dto.enabled).toBe(false);
    expect(flagValueRepository.values).toHaveLength(1);
  });

  it('journals the change with the user name and logs the user id as identity', async () => {
    const { useCase, flagValueRepository, auditLog } = buildUseCase();

    await useCase.execute('flag-1', 'env-1', true, USER);

    expect(flagValueRepository.changes.map((c) => [c.actor, c.source])).toEqual(
      [['Alice', 'ui']],
    );
    expect(auditLog.lines.map((line) => line.identity)).toEqual(['user-1']);
  });

  it('neither journals nor logs an unchanged value', async () => {
    const { useCase, flagValueRepository, auditLog } = buildUseCase();

    await useCase.execute('flag-1', 'env-1', true, USER);
    await useCase.execute('flag-1', 'env-1', true, USER);

    expect(flagValueRepository.changes).toHaveLength(1);
    expect(auditLog.lines).toHaveLength(1);
  });

  it('throws 404 if the flag does not belong to the user', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute('flag-1', 'env-1', true, {
        id: 'other-user',
        name: 'Other',
      }),
    ).rejects.toThrow(/not found/);
  });

  it('throws 404 if the environment does not belong to the same app', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute('flag-1', 'unknown-env', true, USER),
    ).rejects.toThrow(/not found/);
  });
});

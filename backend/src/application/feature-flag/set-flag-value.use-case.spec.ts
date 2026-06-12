import { App } from '../../domain/app/app';
import { AppRepository } from '../../domain/app/app.repository';
import { Environment } from '../../domain/environment/environment';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { FlagValue } from '../../domain/feature-flag/flag-value';
import { FlagValueRepository } from '../../domain/feature-flag/flag-value.repository';
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
  async upsert(flagValue: FlagValue): Promise<FlagValue> {
    this.values = this.values.filter(
      (v) =>
        !(
          v.flagId === flagValue.flagId &&
          v.environmentId === flagValue.environmentId
        ),
    );
    this.values.push(flagValue);
    return flagValue;
  }
  async deleteByFlagId(): Promise<void> {}
  async deleteByEnvironmentId(): Promise<void> {}
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
  createdAt: new Date('2026-01-01'),
});

function buildUseCase() {
  const appRepository = new InMemoryAppRepository([APP]);
  const environmentRepository = new InMemoryEnvironmentRepository([ENV]);
  const flagRepository = new InMemoryFeatureFlagRepository([FLAG]);
  const flagValueRepository = new InMemoryFlagValueRepository();

  return {
    useCase: new SetFlagValueUseCase(
      appRepository,
      flagRepository,
      environmentRepository,
      flagValueRepository,
    ),
    flagValueRepository,
  };
}

describe('SetFlagValueUseCase', () => {
  it('creates a flag value when none exists', async () => {
    const { useCase, flagValueRepository } = buildUseCase();

    const dto = await useCase.execute('flag-1', 'env-1', true, 'user-1');

    expect(dto.enabled).toBe(true);
    expect(dto.environmentId).toBe('env-1');
    expect(flagValueRepository.values).toHaveLength(1);
  });

  it('upserts (updates) an existing flag value', async () => {
    const { useCase, flagValueRepository } = buildUseCase();

    await useCase.execute('flag-1', 'env-1', true, 'user-1');
    const dto = await useCase.execute('flag-1', 'env-1', false, 'user-1');

    expect(dto.enabled).toBe(false);
    expect(flagValueRepository.values).toHaveLength(1);
  });

  it('throws 404 if the flag does not belong to the user', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute('flag-1', 'env-1', true, 'other-user'),
    ).rejects.toThrow();
  });

  it('throws 404 if the environment does not belong to the same app', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute('flag-1', 'unknown-env', true, 'user-1'),
    ).rejects.toThrow();
  });
});

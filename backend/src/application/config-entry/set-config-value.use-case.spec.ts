import { App } from '../../domain/app/app';
import { AppRepository } from '../../domain/app/app.repository';
import { ConfigEntry } from '../../domain/config-entry/config-entry';
import { ConfigEntryRepository } from '../../domain/config-entry/config-entry.repository';
import { ConfigValue } from '../../domain/config-entry/config-value';
import { ConfigValueType } from '../../domain/config-entry/config-value-type.enum';
import { ConfigValueRepository } from '../../domain/config-entry/config-value.repository';
import { Environment } from '../../domain/environment/environment';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { SetConfigValueUseCase } from './set-config-value.use-case';

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

class InMemoryConfigEntryRepository extends ConfigEntryRepository {
  constructor(private readonly entries: ConfigEntry[]) {
    super();
  }
  async findAllByAppId(appId: string): Promise<ConfigEntry[]> {
    return this.entries.filter((e) => e.appId === appId);
  }
  async findById(id: string): Promise<ConfigEntry | null> {
    return this.entries.find((e) => e.id === id) ?? null;
  }
  async findByKey(): Promise<ConfigEntry | null> {
    return null;
  }
  async save(): Promise<void> {}
  async delete(): Promise<void> {}
}

class InMemoryConfigValueRepository extends ConfigValueRepository {
  values: ConfigValue[] = [];

  async findAllByConfigEntryId(configEntryId: string): Promise<ConfigValue[]> {
    return this.values.filter((v) => v.configEntryId === configEntryId);
  }
  async findAllByAppId(): Promise<ConfigValue[]> {
    return this.values;
  }
  async findOne(
    configEntryId: string,
    environmentId: string,
  ): Promise<ConfigValue | null> {
    return (
      this.values.find(
        (v) =>
          v.configEntryId === configEntryId &&
          v.environmentId === environmentId,
      ) ?? null
    );
  }
  async upsert(configValue: ConfigValue): Promise<ConfigValue> {
    this.values = this.values.filter(
      (v) =>
        !(
          v.configEntryId === configValue.configEntryId &&
          v.environmentId === configValue.environmentId
        ),
    );
    this.values.push(configValue);
    return configValue;
  }
  async deleteByConfigEntryId(): Promise<void> {}
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

function makeConfigEntry(type: ConfigValueType): ConfigEntry {
  return ConfigEntry.create({
    id: 'config-1',
    appId: 'app-1',
    key: 'max-upload-size-mb',
    name: 'Max upload size (MB)',
    description: null,
    type,
    createdAt: new Date('2026-01-01'),
  });
}

function buildUseCase(configEntry: ConfigEntry) {
  const appRepository = new InMemoryAppRepository([APP]);
  const environmentRepository = new InMemoryEnvironmentRepository([ENV]);
  const configEntryRepository = new InMemoryConfigEntryRepository([
    configEntry,
  ]);
  const configValueRepository = new InMemoryConfigValueRepository();

  return {
    useCase: new SetConfigValueUseCase(
      appRepository,
      configEntryRepository,
      environmentRepository,
      configValueRepository,
    ),
    configValueRepository,
  };
}

describe('SetConfigValueUseCase', () => {
  it('sets a NUMBER value', async () => {
    const { useCase, configValueRepository } = buildUseCase(
      makeConfigEntry(ConfigValueType.NUMBER),
    );

    const dto = await useCase.execute('config-1', 'env-1', '42', 'user-1');

    expect(dto.value).toBe('42');
    expect(configValueRepository.values).toHaveLength(1);
  });

  it('rejects a non-numeric value for a NUMBER config entry', async () => {
    const { useCase } = buildUseCase(makeConfigEntry(ConfigValueType.NUMBER));

    await expect(
      useCase.execute('config-1', 'env-1', 'not-a-number', 'user-1'),
    ).rejects.toThrow();
  });

  it('sets a BOOLEAN value', async () => {
    const { useCase } = buildUseCase(makeConfigEntry(ConfigValueType.BOOLEAN));

    const dto = await useCase.execute('config-1', 'env-1', 'true', 'user-1');
    expect(dto.value).toBe('true');
  });

  it('rejects an invalid BOOLEAN value', async () => {
    const { useCase } = buildUseCase(makeConfigEntry(ConfigValueType.BOOLEAN));

    await expect(
      useCase.execute('config-1', 'env-1', 'yes', 'user-1'),
    ).rejects.toThrow();
  });

  it('sets a JSON value', async () => {
    const { useCase } = buildUseCase(makeConfigEntry(ConfigValueType.JSON));

    const dto = await useCase.execute('config-1', 'env-1', '{"a":1}', 'user-1');
    expect(dto.value).toBe('{"a":1}');
  });

  it('rejects invalid JSON', async () => {
    const { useCase } = buildUseCase(makeConfigEntry(ConfigValueType.JSON));

    await expect(
      useCase.execute('config-1', 'env-1', '{invalid}', 'user-1'),
    ).rejects.toThrow();
  });

  it('upserts (updates) an existing config value', async () => {
    const { useCase, configValueRepository } = buildUseCase(
      makeConfigEntry(ConfigValueType.STRING),
    );

    await useCase.execute('config-1', 'env-1', 'hello', 'user-1');
    const dto = await useCase.execute('config-1', 'env-1', 'world', 'user-1');

    expect(dto.value).toBe('world');
    expect(configValueRepository.values).toHaveLength(1);
  });

  it('throws 404 if the config entry does not belong to the user', async () => {
    const { useCase } = buildUseCase(makeConfigEntry(ConfigValueType.STRING));

    await expect(
      useCase.execute('config-1', 'env-1', 'hello', 'other-user'),
    ).rejects.toThrow();
  });

  it('throws 404 if the environment does not belong to the same app', async () => {
    const { useCase } = buildUseCase(makeConfigEntry(ConfigValueType.STRING));

    await expect(
      useCase.execute('config-1', 'unknown-env', 'hello', 'user-1'),
    ).rejects.toThrow();
  });
});

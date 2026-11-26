import { serializedTypeOrmRoot } from '../../test-support/serialized-typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ApiKeyRepository } from '../../domain/api-key/api-key.repository';
import { ConfigValueType } from '../../domain/config-entry/config-value-type.enum';
import { ENTITIES } from '../../infrastructure/persistence/entities';
import { MIGRATIONS } from '../../infrastructure/persistence/migrations';
import { AppApiKeysController } from './controllers/app-api-keys.controller';
import { AppConfigsController } from './controllers/app-configs.controller';
import { AppEnvironmentsController } from './controllers/app-environments.controller';
import { AppFlagsController } from './controllers/app-flags.controller';
import { ApiKeysController } from './controllers/api-keys.controller';
import { AppsController } from './controllers/apps.controller';
import { ConfigsController } from './controllers/configs.controller';
import { EnvironmentsController } from './controllers/environments.controller';
import { FlagsController } from './controllers/flags.controller';
import { PublicApiController } from './controllers/public-api.controller';
import { FeatureFlagModule } from './modules/feature-flag.module';
import { testConfigModule } from '../../test-support/test-config.module';

const USER = { id: 'user-1', email: 'user@example.com', name: 'User One' };
const OTHER_USER = { id: 'user-2', email: 'o@example.com', name: 'Other' };

describe('PublicApiController (integration)', () => {
  let appsController: AppsController;
  let appEnvironmentsController: AppEnvironmentsController;
  let environmentsController: EnvironmentsController;
  let appFlagsController: AppFlagsController;
  let flagsController: FlagsController;
  let appConfigsController: AppConfigsController;
  let configsController: ConfigsController;
  let appApiKeysController: AppApiKeysController;
  let apiKeysController: ApiKeysController;
  let publicApiController: PublicApiController;
  let dataSource: DataSource;
  let apiKeyRepository: ApiKeyRepository;
  let counter = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        testConfigModule(),
        // The real migrations, so the foreign keys (ON DELETE RESTRICT) are the production ones.
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
    environmentsController = moduleRef.get(EnvironmentsController);
    appFlagsController = moduleRef.get(AppFlagsController);
    flagsController = moduleRef.get(FlagsController);
    appConfigsController = moduleRef.get(AppConfigsController);
    configsController = moduleRef.get(ConfigsController);
    appApiKeysController = moduleRef.get(AppApiKeysController);
    apiKeysController = moduleRef.get(ApiKeysController);
    publicApiController = moduleRef.get(PublicApiController);
    dataSource = moduleRef.get(DataSource);
    apiKeyRepository = moduleRef.get(ApiKeyRepository);
  });

  async function appWithEnvironments() {
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
    const staging = await appEnvironmentsController.create(
      app.id,
      { name: 'Staging', slug: 'staging' },
      USER,
    );
    return { app, production, staging };
  }

  it('returns flags and configs for the environment the key is bound to', async () => {
    const { app, production, staging } = await appWithEnvironments();
    const checkoutFlag = await appFlagsController.create(
      app.id,
      { key: 'new-checkout-flow', name: 'New checkout', description: null },
      USER,
    );
    const darkModeFlag = await appFlagsController.create(
      app.id,
      { key: 'dark-mode', name: 'Dark mode', description: null },
      USER,
    );
    await flagsController.setValue(
      checkoutFlag.id,
      production.id,
      { enabled: true },
      USER,
    );
    await flagsController.setValue(
      darkModeFlag.id,
      staging.id,
      { enabled: true },
      USER,
    );
    const maxRetries = await appConfigsController.create(
      app.id,
      {
        key: 'max-retries',
        name: 'Max retries',
        description: null,
        type: ConfigValueType.NUMBER,
      },
      USER,
    );
    await configsController.setValue(
      maxRetries.id,
      production.id,
      { value: '3' },
      USER,
    );

    const created = await appApiKeysController.create(
      app.id,
      {
        name: 'production server',
        environmentId: production.id,
        scope: 'server',
      },
      USER,
    );
    expect(created.key).toMatch(/^hf_[0-9a-f]{64}$/);
    expect(created.environmentId).toBe(production.id);
    expect(created.scope).toBe('server');

    const result = await publicApiController.flagsAndConfigs(
      `Bearer ${created.key}`,
      { environment: 'production' },
    );

    expect(result).toEqual({
      app: app.slug,
      environment: 'production',
      flags: { 'new-checkout-flow': true, 'dark-mode': false },
      configs: { 'max-retries': 3 },
    });
    const keys = await appApiKeysController.list(app.id, USER);
    expect(keys[0].lastUsedAt).not.toBeNull();
    expect(keys[0]).not.toHaveProperty('key');
  });

  it('refuses with 400 an environment other than the key one', async () => {
    const { app, production } = await appWithEnvironments();
    const created = await appApiKeysController.create(
      app.id,
      { name: 'prod', environmentId: production.id, scope: 'server' },
      USER,
    );

    await expect(
      publicApiController.flagsAndConfigs(`Bearer ${created.key}`, {
        environment: 'staging',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      publicApiController.flagsAndConfigs(`Bearer ${created.key}`, {
        environment: 'does-not-exist',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // The flag is not client-exposed: a web key never sees it, nor any config.
  it('hides non-exposed flags and every config from a web key', async () => {
    const { app, production } = await appWithEnvironments();
    const flag = await appFlagsController.create(
      app.id,
      { key: 'secret-flag', name: 'Secret', description: null },
      USER,
    );
    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: true },
      USER,
    );
    const created = await appApiKeysController.create(
      app.id,
      { name: 'spa', environmentId: production.id, scope: 'web' },
      USER,
    );

    const result = await publicApiController.flagsAndConfigs(
      `Bearer ${created.key}`,
      { environment: 'production' },
    );

    expect(result.flags).toEqual({});
    expect(result.configs).toEqual({});
  });

  it('writes lastUsedAt at most once per ten minutes', async () => {
    const { app, production } = await appWithEnvironments();
    const created = await appApiKeysController.create(
      app.id,
      { name: 'prod', environmentId: production.id, scope: 'server' },
      USER,
    );
    const touch = vi.spyOn(apiKeyRepository, 'touchLastUsedAt');

    for (let i = 0; i < 5; i += 1) {
      await publicApiController.flagsAndConfigs(`Bearer ${created.key}`, {
        environment: 'production',
      });
    }
    const first = (await appApiKeysController.list(app.id, USER))[0].lastUsedAt;
    await publicApiController.flagsAndConfigs(`Bearer ${created.key}`, {
      environment: 'production',
    });

    expect(first).not.toBeNull();
    expect((await appApiKeysController.list(app.id, USER))[0].lastUsedAt).toBe(
      first,
    );
    expect(touch).toHaveBeenCalledTimes(1);
    touch.mockRestore();
  });

  it('refuses a key creation without an environment of the same app', async () => {
    const { app } = await appWithEnvironments();
    const other = await appWithEnvironments();

    await expect(
      appApiKeysController.create(
        app.id,
        { name: 'k', environmentId: other.production.id, scope: 'server' },
        USER,
      ),
    ).rejects.toThrow(NotFoundException);
    await expect(
      appApiKeysController.create(
        app.id,
        { name: 'k', environmentId: 'missing', scope: 'server' },
        USER,
      ),
    ).rejects.toThrow(NotFoundException);
    await expect(
      appApiKeysController.create(
        app.id,
        { name: 'k', environmentId: other.production.id, scope: 'server' },
        OTHER_USER,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses with 409 the deletion of an environment that still has keys', async () => {
    const { app, production, staging } = await appWithEnvironments();
    const created = await appApiKeysController.create(
      app.id,
      { name: 'prod', environmentId: production.id, scope: 'server' },
      USER,
    );

    await expect(
      environmentsController.remove(production.id, USER),
    ).rejects.toThrow(ConflictException);
    await environmentsController.remove(staging.id, USER);

    await apiKeysController.remove(created.id, USER);
    await environmentsController.remove(production.id, USER);
    expect(await appEnvironmentsController.list(app.id, USER)).toEqual([]);
  });

  it('still deletes an app whose environments have keys', async () => {
    const { app, production, staging } = await appWithEnvironments();
    await appApiKeysController.create(
      app.id,
      { name: 'prod', environmentId: production.id, scope: 'server' },
      USER,
    );
    await appApiKeysController.create(
      app.id,
      { name: 'staging', environmentId: staging.id, scope: 'web' },
      USER,
    );

    await appsController.remove(app.id, USER);

    await expect(appsController.get(app.id, USER)).rejects.toThrow(/not found/);
    expect(
      await dataSource.query('SELECT id FROM api_keys WHERE app_id = ?', [
        app.id,
      ]),
    ).toEqual([]);
    expect(await dataSource.query('PRAGMA foreign_key_check')).toEqual([]);
  });

  it.each([
    ['an unknown key', `Bearer hf_${'0'.repeat(64)}`],
    ['a legacy-format key', `Bearer ${'0'.repeat(64)}`],
    ['a missing header', undefined],
    ['another scheme', `Basic hf_${'0'.repeat(64)}`],
  ])('rejects %s with 401', async (_label, header) => {
    await expect(
      publicApiController.flagsAndConfigs(header, {
        environment: 'production',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('revoking an API key makes it unusable', async () => {
    const { app, production } = await appWithEnvironments();
    const created = await appApiKeysController.create(
      app.id,
      { name: 'key', environmentId: production.id, scope: 'server' },
      USER,
    );

    await apiKeysController.remove(created.id, USER);

    await expect(
      publicApiController.flagsAndConfigs(`Bearer ${created.key}`, {
        environment: 'production',
      }),
    ).rejects.toThrow(UnauthorizedException);
    await expect(appApiKeysController.list(app.id, USER)).resolves.toHaveLength(
      0,
    );
  });
});

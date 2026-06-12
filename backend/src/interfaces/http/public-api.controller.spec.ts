import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigValueType } from '../../domain/config-entry/config-value-type.enum';
import { ApiKeyOrmEntity } from '../../infrastructure/persistence/entities/api-key.orm-entity';
import { AppOrmEntity } from '../../infrastructure/persistence/entities/app.orm-entity';
import { ConfigEntryOrmEntity } from '../../infrastructure/persistence/entities/config-entry.orm-entity';
import { ConfigValueOrmEntity } from '../../infrastructure/persistence/entities/config-value.orm-entity';
import { EnvironmentOrmEntity } from '../../infrastructure/persistence/entities/environment.orm-entity';
import { FeatureFlagOrmEntity } from '../../infrastructure/persistence/entities/feature-flag.orm-entity';
import { FlagValueOrmEntity } from '../../infrastructure/persistence/entities/flag-value.orm-entity';
import { AppApiKeysController } from './controllers/app-api-keys.controller';
import { AppConfigsController } from './controllers/app-configs.controller';
import { AppEnvironmentsController } from './controllers/app-environments.controller';
import { AppFlagsController } from './controllers/app-flags.controller';
import { ApiKeysController } from './controllers/api-keys.controller';
import { AppsController } from './controllers/apps.controller';
import { ConfigsController } from './controllers/configs.controller';
import { FlagsController } from './controllers/flags.controller';
import { PublicApiController } from './controllers/public-api.controller';
import { FeatureFlagModule } from './modules/feature-flag.module';

const USER = { id: 'user-1', email: 'user@example.com', name: 'User One' };

describe('PublicApiController (integration)', () => {
  let appsController: AppsController;
  let appEnvironmentsController: AppEnvironmentsController;
  let appFlagsController: AppFlagsController;
  let flagsController: FlagsController;
  let appConfigsController: AppConfigsController;
  let configsController: ConfigsController;
  let appApiKeysController: AppApiKeysController;
  let apiKeysController: ApiKeysController;
  let publicApiController: PublicApiController;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          dropSchema: true,
          synchronize: true,
          entities: [
            AppOrmEntity,
            EnvironmentOrmEntity,
            FeatureFlagOrmEntity,
            FlagValueOrmEntity,
            ConfigEntryOrmEntity,
            ConfigValueOrmEntity,
            ApiKeyOrmEntity,
          ],
        }),
        FeatureFlagModule,
      ],
    }).compile();

    appsController = moduleRef.get(AppsController);
    appEnvironmentsController = moduleRef.get(AppEnvironmentsController);
    appFlagsController = moduleRef.get(AppFlagsController);
    flagsController = moduleRef.get(FlagsController);
    appConfigsController = moduleRef.get(AppConfigsController);
    configsController = moduleRef.get(ConfigsController);
    appApiKeysController = moduleRef.get(AppApiKeysController);
    apiKeysController = moduleRef.get(ApiKeysController);
    publicApiController = moduleRef.get(PublicApiController);
  });

  it('returns flags and configs for a valid key and environment', async () => {
    const app = await appsController.create(
      { name: 'Ecommerce Core', slug: 'ecommerce-core', description: null },
      USER,
    );

    const production = await appEnvironmentsController.create(
      app.id,
      { name: 'Production', slug: 'production' },
      USER,
    );
    await appEnvironmentsController.create(
      app.id,
      { name: 'Staging', slug: 'staging' },
      USER,
    );

    const checkoutFlag = await appFlagsController.create(
      app.id,
      {
        key: 'new-checkout-flow',
        name: 'New checkout flow',
        description: null,
      },
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
      production.id,
      { enabled: false },
      USER,
    );
    // Staging is intentionally left unset for darkModeFlag/checkoutFlag.

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
    const bannerText = await appConfigsController.create(
      app.id,
      {
        key: 'feature-banner-text',
        name: 'Feature banner text',
        description: null,
        type: ConfigValueType.STRING,
      },
      USER,
    );
    const paymentProviders = await appConfigsController.create(
      app.id,
      {
        key: 'payment-providers',
        name: 'Payment providers',
        description: null,
        type: ConfigValueType.JSON,
      },
      USER,
    );
    const maintenanceMode = await appConfigsController.create(
      app.id,
      {
        key: 'maintenance-mode',
        name: 'Maintenance mode',
        description: null,
        type: ConfigValueType.BOOLEAN,
      },
      USER,
    );

    await configsController.setValue(
      maxRetries.id,
      production.id,
      { value: '3' },
      USER,
    );
    await configsController.setValue(
      bannerText.id,
      production.id,
      { value: 'Welcome' },
      USER,
    );
    await configsController.setValue(
      paymentProviders.id,
      production.id,
      { value: '["stripe","paypal"]' },
      USER,
    );
    await configsController.setValue(
      maintenanceMode.id,
      production.id,
      { value: 'true' },
      USER,
    );

    const created = await appApiKeysController.create(
      app.id,
      { name: 'production server' },
      USER,
    );
    expect(created.key).toMatch(/^[0-9a-f]{64}$/);

    const result = await publicApiController.flagsAndConfigs(
      `Bearer ${created.key}`,
      { environment: 'production' },
    );

    expect(result).toEqual({
      app: 'ecommerce-core',
      environment: 'production',
      flags: {
        'new-checkout-flow': true,
        'dark-mode': false,
      },
      configs: {
        'max-retries': 3,
        'feature-banner-text': 'Welcome',
        'payment-providers': ['stripe', 'paypal'],
        'maintenance-mode': true,
      },
    });

    // lastUsedAt is updated on successful lookup.
    const keys = await appApiKeysController.list(app.id, USER);
    expect(keys[0].lastUsedAt).not.toBeNull();

    // Unset flags/configs in staging fall back to defaults (false / null).
    const stagingResult = await publicApiController.flagsAndConfigs(
      `Bearer ${created.key}`,
      { environment: 'staging' },
    );
    expect(stagingResult.flags).toEqual({
      'new-checkout-flow': false,
      'dark-mode': false,
    });
    expect(stagingResult.configs).toEqual({
      'max-retries': null,
      'feature-banner-text': null,
      'payment-providers': null,
      'maintenance-mode': null,
    });
  });

  it('rejects an invalid API key with 401', async () => {
    await expect(
      publicApiController.flagsAndConfigs('Bearer not-a-real-key', {
        environment: 'production',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a missing Authorization header with 401', async () => {
    await expect(
      publicApiController.flagsAndConfigs(undefined, {
        environment: 'production',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns 404 when the environment slug does not exist for the app', async () => {
    const app = await appsController.create(
      { name: 'Other App', slug: 'other-app', description: null },
      USER,
    );
    await appEnvironmentsController.create(
      app.id,
      { name: 'Production', slug: 'production' },
      USER,
    );
    const created = await appApiKeysController.create(
      app.id,
      { name: 'key' },
      USER,
    );

    await expect(
      publicApiController.flagsAndConfigs(`Bearer ${created.key}`, {
        environment: 'does-not-exist',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('revoking an API key makes it unusable', async () => {
    const app = await appsController.create(
      { name: 'Revoke App', slug: 'revoke-app', description: null },
      USER,
    );
    await appEnvironmentsController.create(
      app.id,
      { name: 'Production', slug: 'production' },
      USER,
    );
    const created = await appApiKeysController.create(
      app.id,
      { name: 'key' },
      USER,
    );

    const keys = await appApiKeysController.list(app.id, USER);
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toHaveProperty('key');

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

import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppOrmEntity } from '../../infrastructure/persistence/entities/app.orm-entity';
import { ConfigEntryOrmEntity } from '../../infrastructure/persistence/entities/config-entry.orm-entity';
import { ConfigValueOrmEntity } from '../../infrastructure/persistence/entities/config-value.orm-entity';
import { EnvironmentOrmEntity } from '../../infrastructure/persistence/entities/environment.orm-entity';
import { FeatureFlagOrmEntity } from '../../infrastructure/persistence/entities/feature-flag.orm-entity';
import { FlagValueOrmEntity } from '../../infrastructure/persistence/entities/flag-value.orm-entity';
import { ConfigValueType } from '../../domain/config-entry/config-value-type.enum';
import { AppEnvironmentsController } from './controllers/app-environments.controller';
import { AppConfigsController } from './controllers/app-configs.controller';
import { AppFlagsController } from './controllers/app-flags.controller';
import { AppsController } from './controllers/apps.controller';
import { ConfigsController } from './controllers/configs.controller';
import { EnvironmentsController } from './controllers/environments.controller';
import { FlagsController } from './controllers/flags.controller';
import { FeatureFlagModule } from './modules/feature-flag.module';

const USER = { id: 'user-1', email: 'user@example.com', name: 'User One' };
const OTHER_USER = {
  id: 'user-2',
  email: 'other@example.com',
  name: 'Other User',
};

describe('Feature flag controllers (integration)', () => {
  let appsController: AppsController;
  let appEnvironmentsController: AppEnvironmentsController;
  let environmentsController: EnvironmentsController;
  let appFlagsController: AppFlagsController;
  let flagsController: FlagsController;
  let appConfigsController: AppConfigsController;
  let configsController: ConfigsController;

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
          ],
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
  });

  it('supports the full app/environment/flag/config lifecycle', async () => {
    // Create an app
    const app = await appsController.create(
      { name: 'My App', slug: 'my-app', description: null },
      USER,
    );
    expect(app.name).toBe('My App');

    const apps = await appsController.list(USER);
    expect(apps).toHaveLength(1);

    // Create environments
    const staging = await appEnvironmentsController.create(
      app.id,
      { name: 'Staging', slug: 'staging' },
      USER,
    );
    const production = await appEnvironmentsController.create(
      app.id,
      { name: 'Production', slug: 'production' },
      USER,
    );
    expect(staging.order).toBe(0);
    expect(production.order).toBe(1);

    const environments = await appEnvironmentsController.list(app.id, USER);
    expect(environments).toHaveLength(2);

    // Create a feature flag and set per-environment values
    const flag = await appFlagsController.create(
      app.id,
      { key: 'new-checkout', name: 'New checkout', description: null },
      USER,
    );

    await flagsController.setValue(
      flag.id,
      staging.id,
      { enabled: true },
      USER,
    );
    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: false },
      USER,
    );

    const flags = await appFlagsController.list(app.id, USER);
    expect(flags).toHaveLength(1);
    expect(flags[0].values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ environmentId: staging.id, enabled: true }),
        expect.objectContaining({
          environmentId: production.id,
          enabled: false,
        }),
      ]),
    );

    // Create a config entry and set typed values
    const config = await appConfigsController.create(
      app.id,
      {
        key: 'max-items',
        name: 'Max items',
        description: null,
        type: ConfigValueType.NUMBER,
      },
      USER,
    );

    await configsController.setValue(
      config.id,
      staging.id,
      { value: '10' },
      USER,
    );
    await configsController.setValue(
      config.id,
      production.id,
      { value: '100' },
      USER,
    );

    // Setting an invalid value for the config's type is rejected
    await expect(
      configsController.setValue(
        config.id,
        staging.id,
        { value: 'not-a-number' },
        USER,
      ),
    ).rejects.toThrow();

    const configs = await appConfigsController.list(app.id, USER);
    expect(configs).toHaveLength(1);
    expect(configs[0].values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ environmentId: staging.id, value: '10' }),
        expect.objectContaining({ environmentId: production.id, value: '100' }),
      ]),
    );

    // Overview combines everything
    const overview = await appsController.overview(app.id, USER);
    expect(overview.app.id).toBe(app.id);
    expect(overview.environments).toHaveLength(2);
    expect(overview.flags).toHaveLength(1);
    expect(overview.configs).toHaveLength(1);

    // Update and delete an environment
    const renamedStaging = await environmentsController.update(
      staging.id,
      { name: 'Staging (EU)', slug: 'staging' },
      USER,
    );
    expect(renamedStaging.name).toBe('Staging (EU)');

    await environmentsController.remove(production.id, USER);
    const remainingEnvironments = await appEnvironmentsController.list(
      app.id,
      USER,
    );
    expect(remainingEnvironments).toHaveLength(1);

    // Ownership is enforced: a different user cannot access this app
    await expect(appsController.get(app.id, OTHER_USER)).rejects.toThrow();
    await expect(appFlagsController.list(app.id, OTHER_USER)).rejects.toThrow();

    // Delete the app cascades to flags/configs/environments
    await appsController.remove(app.id, USER);
    await expect(appsController.get(app.id, USER)).rejects.toThrow();
  });
});

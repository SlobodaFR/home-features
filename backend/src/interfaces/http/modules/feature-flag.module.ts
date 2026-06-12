import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateApiKeyUseCase } from '../../../application/api-key/create-api-key.use-case';
import { DeleteApiKeyUseCase } from '../../../application/api-key/delete-api-key.use-case';
import { ListApiKeysUseCase } from '../../../application/api-key/list-api-keys.use-case';
import { CreateAppUseCase } from '../../../application/app/create-app.use-case';
import { DeleteAppUseCase } from '../../../application/app/delete-app.use-case';
import { GetAppUseCase } from '../../../application/app/get-app.use-case';
import { ListAppsUseCase } from '../../../application/app/list-apps.use-case';
import { UpdateAppUseCase } from '../../../application/app/update-app.use-case';
import { CreateConfigEntryUseCase } from '../../../application/config-entry/create-config-entry.use-case';
import { DeleteConfigEntryUseCase } from '../../../application/config-entry/delete-config-entry.use-case';
import { ListConfigEntriesUseCase } from '../../../application/config-entry/list-config-entries.use-case';
import { SetConfigValueUseCase } from '../../../application/config-entry/set-config-value.use-case';
import { UpdateConfigEntryUseCase } from '../../../application/config-entry/update-config-entry.use-case';
import { CreateEnvironmentUseCase } from '../../../application/environment/create-environment.use-case';
import { DeleteEnvironmentUseCase } from '../../../application/environment/delete-environment.use-case';
import { ListEnvironmentsUseCase } from '../../../application/environment/list-environments.use-case';
import { ReorderEnvironmentsUseCase } from '../../../application/environment/reorder-environments.use-case';
import { UpdateEnvironmentUseCase } from '../../../application/environment/update-environment.use-case';
import { CreateFeatureFlagUseCase } from '../../../application/feature-flag/create-feature-flag.use-case';
import { DeleteFeatureFlagUseCase } from '../../../application/feature-flag/delete-feature-flag.use-case';
import { ListFeatureFlagsUseCase } from '../../../application/feature-flag/list-feature-flags.use-case';
import { SetFlagValueUseCase } from '../../../application/feature-flag/set-flag-value.use-case';
import { UpdateFeatureFlagUseCase } from '../../../application/feature-flag/update-feature-flag.use-case';
import { GetAppOverviewUseCase } from '../../../application/overview/get-app-overview.use-case';
import { GetFlagsAndConfigsUseCase } from '../../../application/public-api/get-flags-and-configs.use-case';
import { ApiKeyRepository } from '../../../domain/api-key/api-key.repository';
import { AppRepository } from '../../../domain/app/app.repository';
import { ConfigEntryRepository } from '../../../domain/config-entry/config-entry.repository';
import { ConfigValueRepository } from '../../../domain/config-entry/config-value.repository';
import { EnvironmentRepository } from '../../../domain/environment/environment.repository';
import { FeatureFlagRepository } from '../../../domain/feature-flag/feature-flag.repository';
import { FlagValueRepository } from '../../../domain/feature-flag/flag-value.repository';
import { ApiKeyOrmEntity } from '../../../infrastructure/persistence/entities/api-key.orm-entity';
import { AppOrmEntity } from '../../../infrastructure/persistence/entities/app.orm-entity';
import { ConfigEntryOrmEntity } from '../../../infrastructure/persistence/entities/config-entry.orm-entity';
import { ConfigValueOrmEntity } from '../../../infrastructure/persistence/entities/config-value.orm-entity';
import { EnvironmentOrmEntity } from '../../../infrastructure/persistence/entities/environment.orm-entity';
import { FeatureFlagOrmEntity } from '../../../infrastructure/persistence/entities/feature-flag.orm-entity';
import { FlagValueOrmEntity } from '../../../infrastructure/persistence/entities/flag-value.orm-entity';
import { TypeOrmApiKeyRepository } from '../../../infrastructure/persistence/repositories/typeorm-api-key.repository';
import { TypeOrmAppRepository } from '../../../infrastructure/persistence/repositories/typeorm-app.repository';
import { TypeOrmConfigEntryRepository } from '../../../infrastructure/persistence/repositories/typeorm-config-entry.repository';
import { TypeOrmConfigValueRepository } from '../../../infrastructure/persistence/repositories/typeorm-config-value.repository';
import { TypeOrmEnvironmentRepository } from '../../../infrastructure/persistence/repositories/typeorm-environment.repository';
import { TypeOrmFeatureFlagRepository } from '../../../infrastructure/persistence/repositories/typeorm-feature-flag.repository';
import { TypeOrmFlagValueRepository } from '../../../infrastructure/persistence/repositories/typeorm-flag-value.repository';
import { ApiKeysController } from '../controllers/api-keys.controller';
import { AppApiKeysController } from '../controllers/app-api-keys.controller';
import { AppConfigsController } from '../controllers/app-configs.controller';
import { AppEnvironmentsController } from '../controllers/app-environments.controller';
import { AppFlagsController } from '../controllers/app-flags.controller';
import { AppsController } from '../controllers/apps.controller';
import { ConfigsController } from '../controllers/configs.controller';
import { EnvironmentsController } from '../controllers/environments.controller';
import { FlagsController } from '../controllers/flags.controller';
import { PublicApiController } from '../controllers/public-api.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AppOrmEntity,
      EnvironmentOrmEntity,
      FeatureFlagOrmEntity,
      FlagValueOrmEntity,
      ConfigEntryOrmEntity,
      ConfigValueOrmEntity,
      ApiKeyOrmEntity,
    ]),
  ],
  controllers: [
    AppsController,
    AppEnvironmentsController,
    EnvironmentsController,
    AppFlagsController,
    FlagsController,
    AppConfigsController,
    ConfigsController,
    AppApiKeysController,
    ApiKeysController,
    PublicApiController,
  ],
  providers: [
    { provide: AppRepository, useClass: TypeOrmAppRepository },
    { provide: EnvironmentRepository, useClass: TypeOrmEnvironmentRepository },
    { provide: FeatureFlagRepository, useClass: TypeOrmFeatureFlagRepository },
    { provide: FlagValueRepository, useClass: TypeOrmFlagValueRepository },
    { provide: ConfigEntryRepository, useClass: TypeOrmConfigEntryRepository },
    { provide: ConfigValueRepository, useClass: TypeOrmConfigValueRepository },
    { provide: ApiKeyRepository, useClass: TypeOrmApiKeyRepository },
    // App
    ListAppsUseCase,
    GetAppUseCase,
    CreateAppUseCase,
    UpdateAppUseCase,
    DeleteAppUseCase,
    // Environment
    ListEnvironmentsUseCase,
    CreateEnvironmentUseCase,
    UpdateEnvironmentUseCase,
    DeleteEnvironmentUseCase,
    ReorderEnvironmentsUseCase,
    // FeatureFlag
    ListFeatureFlagsUseCase,
    CreateFeatureFlagUseCase,
    UpdateFeatureFlagUseCase,
    DeleteFeatureFlagUseCase,
    SetFlagValueUseCase,
    // ConfigEntry
    ListConfigEntriesUseCase,
    CreateConfigEntryUseCase,
    UpdateConfigEntryUseCase,
    DeleteConfigEntryUseCase,
    SetConfigValueUseCase,
    // Overview
    GetAppOverviewUseCase,
    // API keys
    ListApiKeysUseCase,
    CreateApiKeyUseCase,
    DeleteApiKeyUseCase,
    // Public exposure API
    GetFlagsAndConfigsUseCase,
  ],
})
export class FeatureFlagModule {}

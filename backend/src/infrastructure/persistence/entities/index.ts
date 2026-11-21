import { ApiKeyOrmEntity } from './api-key.orm-entity';
import { AppOrmEntity } from './app.orm-entity';
import { ConfigEntryOrmEntity } from './config-entry.orm-entity';
import { ConfigValueOrmEntity } from './config-value.orm-entity';
import { EnvironmentOrmEntity } from './environment.orm-entity';
import { FeatureFlagOrmEntity } from './feature-flag.orm-entity';
import { FlagValueChangeOrmEntity } from './flag-value-change.orm-entity';
import { FlagValueOrmEntity } from './flag-value.orm-entity';
import { RevokedSessionOrmEntity } from './revoked-session.orm-entity';
import { UserOrmEntity } from './user.orm-entity';

/** Single list of persisted entities: database module, migrations and tests. */
export const ENTITIES = [
  UserOrmEntity,
  RevokedSessionOrmEntity,
  AppOrmEntity,
  EnvironmentOrmEntity,
  FeatureFlagOrmEntity,
  FlagValueOrmEntity,
  ConfigEntryOrmEntity,
  ConfigValueOrmEntity,
  ApiKeyOrmEntity,
  FlagValueChangeOrmEntity,
];

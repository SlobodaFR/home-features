import { ConfigValue } from './config-value';

/**
 * Port (driven side) implemented by the infrastructure layer.
 */
export abstract class ConfigValueRepository {
  abstract findAllByConfigEntryId(
    configEntryId: string,
  ): Promise<ConfigValue[]>;
  abstract findAllByAppId(appId: string): Promise<ConfigValue[]>;
  abstract findOne(
    configEntryId: string,
    environmentId: string,
  ): Promise<ConfigValue | null>;
  /** Insert or update the ConfigValue for the (configEntryId, environmentId) pair. */
  abstract upsert(configValue: ConfigValue): Promise<ConfigValue>;
  abstract deleteByConfigEntryId(configEntryId: string): Promise<void>;
  abstract deleteByEnvironmentId(environmentId: string): Promise<void>;
}

import { ConfigEntry } from './config-entry';

/**
 * Port (driven side) implemented by the infrastructure layer.
 */
export abstract class ConfigEntryRepository {
  abstract findAllByAppId(appId: string): Promise<ConfigEntry[]>;
  abstract findById(id: string): Promise<ConfigEntry | null>;
  abstract findByKey(appId: string, key: string): Promise<ConfigEntry | null>;
  abstract save(configEntry: ConfigEntry): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

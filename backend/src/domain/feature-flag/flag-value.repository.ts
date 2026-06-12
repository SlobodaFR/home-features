import { FlagValue } from './flag-value';

/**
 * Port (driven side) implemented by the infrastructure layer.
 */
export abstract class FlagValueRepository {
  abstract findAllByFlagId(flagId: string): Promise<FlagValue[]>;
  abstract findAllByAppId(appId: string): Promise<FlagValue[]>;
  abstract findOne(
    flagId: string,
    environmentId: string,
  ): Promise<FlagValue | null>;
  /** Insert or update the FlagValue for the (flagId, environmentId) pair. */
  abstract upsert(flagValue: FlagValue): Promise<FlagValue>;
  abstract deleteByFlagId(flagId: string): Promise<void>;
  abstract deleteByEnvironmentId(environmentId: string): Promise<void>;
}

import { FlagValue } from './flag-value';
import { FlagValueChange, FlagValueChangeSource } from './flag-value-change';

export interface FlagValueChangeAuthor {
  actor: string;
  source: FlagValueChangeSource;
}

export interface RecordedFlagValue {
  value: FlagValue;
  /** null when the value did not change: nothing was written. */
  change: FlagValueChange | null;
}

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
  /**
   * The only way to write a flag value: inserts or updates the FlagValue of the (flagId,
   * environmentId) pair and appends the journal entry (old value, new value, author) in one
   * transaction, either both or neither. Writes nothing when the value is unchanged. There is
   * deliberately no unjournaled write method.
   */
  abstract upsertRecordingChange(
    flagValue: FlagValue,
    author: FlagValueChangeAuthor,
  ): Promise<RecordedFlagValue>;
  abstract deleteByFlagId(flagId: string): Promise<void>;
  abstract deleteByEnvironmentId(environmentId: string): Promise<void>;
}

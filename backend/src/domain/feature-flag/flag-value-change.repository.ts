import { FlagValueChange } from './flag-value-change';

/**
 * Read side of the journal. Entries are only ever written by
 * {@link FlagValueRepository.upsertRecordingChange}, in the value's transaction.
 */
export abstract class FlagValueChangeRepository {
  /** Newest first, at most `limit` entries. */
  abstract findLatestByFlagId(
    flagId: string,
    limit: number,
  ): Promise<FlagValueChange[]>;
}

import { Injectable } from '@nestjs/common';
import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { WriteDebouncer } from '../shared/write-debouncer';

/**
 * Records that consumers read these flags: last_evaluated_at, at most once every ten minutes per
 * flag. Shown in the UI so a flag nobody reads any more can be deleted with confidence.
 */
@Injectable()
export class RecordFlagEvaluationsUseCase {
  constructor(
    private readonly flagRepository: FeatureFlagRepository,
    private readonly debouncer: WriteDebouncer,
  ) {}

  async execute(flags: FeatureFlag[]): Promise<void> {
    const now = new Date();
    const due = flags.filter((flag) =>
      this.debouncer.shouldWrite(`flag:${flag.id}`, flag.lastEvaluatedAt, now),
    );
    if (due.length === 0) {
      return;
    }
    // Best effort: a failed usage write never fails the evaluation.
    try {
      await this.flagRepository.touchLastEvaluatedAt(
        due.map((flag) => flag.id),
        now,
      );
    } catch {
      // ignore
    }
  }
}

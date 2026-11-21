import { Injectable } from '@nestjs/common';
import { Slug } from '../../domain/shared/slug';
import { FeatureFlag } from '../../domain/feature-flag/feature-flag';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { FlagValueRepository } from '../../domain/feature-flag/flag-value.repository';
import { AuthenticatedApiKey } from '../api-key/authenticate-api-key.use-case';
import { RecordFlagEvaluationsUseCase } from '../feature-flag/record-flag-evaluations.use-case';
import { bulkEtag, evaluationOf, OfrepEvaluation } from './ofrep-evaluation';

export interface OfrepBulkEvaluation {
  flags: OfrepEvaluation[];
  etag: string;
}

/**
 * Evaluates flags for an authenticated API key: always in the key's environment, and for a `web`
 * key only among the client-exposed flags (any other flag does not exist for it).
 */
@Injectable()
export class EvaluateOfrepFlagsUseCase {
  constructor(
    private readonly flagRepository: FeatureFlagRepository,
    private readonly flagValueRepository: FlagValueRepository,
    private readonly recordFlagEvaluations: RecordFlagEvaluationsUseCase,
  ) {}

  /** null: FLAG_NOT_FOUND (unknown, malformed, or hidden from a web key). */
  async evaluateOne(
    auth: AuthenticatedApiKey,
    key: string,
  ): Promise<OfrepEvaluation | null> {
    if (!Slug.isValid(key)) {
      return null;
    }
    const flag = await this.flagRepository.findByKey(auth.app.id, key);
    if (!flag || !visibleTo(auth, flag)) {
      return null;
    }
    const value = await this.flagValueRepository.findOne(
      flag.id,
      auth.environment.id,
    );
    await this.recordFlagEvaluations.execute([flag]);
    return evaluationOf(flag, value ?? undefined);
  }

  async evaluateAll(auth: AuthenticatedApiKey): Promise<OfrepBulkEvaluation> {
    const [flags, values] = await Promise.all([
      this.flagRepository.findAllByAppId(auth.app.id),
      this.flagValueRepository.findAllByAppId(auth.app.id),
    ]);
    const visible = flags
      .filter((flag) => visibleTo(auth, flag))
      .toSorted((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const valueOf = (flag: FeatureFlag) =>
      values.find(
        (value) =>
          value.flagId === flag.id &&
          value.environmentId === auth.environment.id,
      );
    await this.recordFlagEvaluations.execute(visible);
    return {
      flags: visible.map((flag) => evaluationOf(flag, valueOf(flag))),
      etag: bulkEtag(
        auth.environment.id,
        visible.map((flag) => ({
          key: flag.key,
          enabled: valueOf(flag)?.enabled ?? null,
        })),
      ),
    };
  }
}

function visibleTo(auth: AuthenticatedApiKey, flag: FeatureFlag): boolean {
  return auth.apiKey.scope === 'server' || flag.clientExposed;
}

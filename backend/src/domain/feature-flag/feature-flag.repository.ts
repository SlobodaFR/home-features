import { FeatureFlag } from './feature-flag';

/**
 * Port (driven side) implemented by the infrastructure layer.
 */
export abstract class FeatureFlagRepository {
  abstract findAllByAppId(appId: string): Promise<FeatureFlag[]>;
  abstract findById(id: string): Promise<FeatureFlag | null>;
  abstract findByKey(appId: string, key: string): Promise<FeatureFlag | null>;
  /** Never writes last_evaluated_at: only {@link touchLastEvaluatedAt} does. */
  abstract save(flag: FeatureFlag): Promise<void>;
  abstract touchLastEvaluatedAt(ids: string[], at: Date): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

import { FeatureFlag } from './feature-flag';

/**
 * Port (driven side) implemented by the infrastructure layer.
 */
export abstract class FeatureFlagRepository {
  abstract findAllByAppId(appId: string): Promise<FeatureFlag[]>;
  abstract findById(id: string): Promise<FeatureFlag | null>;
  abstract findByKey(appId: string, key: string): Promise<FeatureFlag | null>;
  abstract save(flag: FeatureFlag): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

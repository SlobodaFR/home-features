import { Global, Module } from '@nestjs/common';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { createFeatureFlags } from './openfeature-feature-flags';

/**
 * Global: adapters (token verifier, webhook authentication) receive the port without importing
 * the module. home-features does not point at itself: it has no FEATURES_OFREP_URL/FEATURES_API_KEY,
 * so the adapter runs as a no-op and only FEATURES_PIN_<KEY> pins apply.
 */
@Global()
@Module({
  providers: [
    // Read when the module is created, after ConfigModule (.env already in process.env).
    {
      provide: FeatureFlags,
      useFactory: () => createFeatureFlags(process.env),
    },
  ],
  exports: [FeatureFlags],
})
export class FeatureFlagsModule {}

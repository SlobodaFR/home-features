import { Test } from '@nestjs/testing';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { FeatureFlagsModule } from './feature-flags.module';
import { OpenFeatureFeatureFlags } from './openfeature-feature-flags';

describe('FeatureFlagsModule', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('provides the FeatureFlags port, as a no-op without FEATURES_OFREP_URL and FEATURES_API_KEY', async () => {
    delete process.env.FEATURES_OFREP_URL;
    delete process.env.FEATURES_API_KEY;
    const moduleRef = await Test.createTestingModule({
      imports: [FeatureFlagsModule],
    }).compile();
    const flags = moduleRef.get(FeatureFlags);
    expect(flags).toBeInstanceOf(OpenFeatureFeatureFlags);
    expect(await flags.isEnabled('some-flag', false)).toBe(false);
    expect(await flags.isEnabled('some-flag', true)).toBe(true);
  });

  it('applies the emergency pin read from process.env', async () => {
    delete process.env.FEATURES_OFREP_URL;
    delete process.env.FEATURES_API_KEY;
    process.env.FEATURES_PIN_SOME_FLAG = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [FeatureFlagsModule],
    }).compile();
    expect(
      await moduleRef.get(FeatureFlags).isEnabled('some-flag', false),
    ).toBe(true);
  });
});

import { FeatureFlag } from './feature-flag';

describe('FeatureFlag', () => {
  const baseProps = {
    id: 'flag-1',
    appId: 'app-1',
    key: 'new-checkout-flow',
    name: 'New checkout flow',
    description: null,
    createdAt: new Date('2026-01-01'),
  };

  it('creates a valid feature flag', () => {
    const flag = FeatureFlag.create(baseProps);
    expect(flag.key).toBe('new-checkout-flow');
  });

  it('rejects an empty name', () => {
    expect(() => FeatureFlag.create({ ...baseProps, name: '' })).toThrow();
  });

  it('rejects an invalid key', () => {
    expect(() =>
      FeatureFlag.create({ ...baseProps, key: 'New Checkout Flow' }),
    ).toThrow();
  });
});

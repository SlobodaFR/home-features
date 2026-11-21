import { FeatureFlag } from './feature-flag';
import { FlagValue } from './flag-value';

describe('FeatureFlag', () => {
  const baseProps = {
    id: 'flag-1',
    appId: 'app-1',
    key: 'new-checkout-flow',
    name: 'New checkout flow',
    description: null,
    clientExposed: false,
    lastEvaluatedAt: null,
    createdAt: new Date('2026-01-01'),
  };

  const value = (environmentId: string, enabled: boolean) =>
    FlagValue.create({
      id: `v-${environmentId}`,
      flagId: 'flag-1',
      environmentId,
      enabled,
      updatedAt: new Date('2026-01-01'),
    });

  it('creates a valid feature flag, not client-exposed', () => {
    const flag = FeatureFlag.create(baseProps);
    expect(flag.key).toBe('new-checkout-flow');
    expect(flag.clientExposed).toBe(false);
    expect(flag.lastEvaluatedAt).toBeNull();
  });

  it('rejects an empty name', () => {
    expect(() => FeatureFlag.create({ ...baseProps, name: '' })).toThrow(
      /Feature flag name must not be empty/,
    );
  });

  it('rejects an invalid key', () => {
    expect(() =>
      FeatureFlag.create({ ...baseProps, key: 'New Checkout Flow' }),
    ).toThrow(/Invalid slug/);
  });

  it('changes name, description and exposure but never the key', () => {
    const flag = FeatureFlag.create(baseProps).withDetails({
      name: 'Checkout v2',
      description: 'Rollout',
      clientExposed: true,
    });

    expect(flag.key).toBe('new-checkout-flow');
    expect(flag.name).toBe('Checkout v2');
    expect(flag.description).toBe('Rollout');
    expect(flag.clientExposed).toBe(true);
  });

  it('needs a confirmation to be deleted while it is on in an environment', () => {
    const flag = FeatureFlag.create(baseProps);

    expect(flag.deletionNeedsConfirmation([])).toBe(false);
    expect(
      flag.deletionNeedsConfirmation([value('e1', false), value('e2', false)]),
    ).toBe(false);
    expect(
      flag.deletionNeedsConfirmation([value('e1', false), value('e2', true)]),
    ).toBe(true);
  });

  it('is confirmed only by its exact key', () => {
    const flag = FeatureFlag.create(baseProps);

    expect(flag.isDeletionConfirmedBy('new-checkout-flow')).toBe(true);
    expect(flag.isDeletionConfirmedBy('New-checkout-flow')).toBe(false);
    expect(flag.isDeletionConfirmedBy(' new-checkout-flow')).toBe(false);
    expect(flag.isDeletionConfirmedBy(undefined)).toBe(false);
  });
});

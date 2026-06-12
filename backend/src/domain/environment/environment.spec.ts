import { Environment } from './environment';

describe('Environment', () => {
  const baseProps = {
    id: 'env-1',
    appId: 'app-1',
    name: 'Production',
    slug: 'production',
    order: 0,
    createdAt: new Date('2026-01-01'),
  };

  it('creates a valid environment', () => {
    const env = Environment.create(baseProps);
    expect(env.slug).toBe('production');
    expect(env.order).toBe(0);
  });

  it('rejects an empty name', () => {
    expect(() => Environment.create({ ...baseProps, name: '' })).toThrow();
  });

  it('rejects an invalid slug', () => {
    expect(() =>
      Environment.create({ ...baseProps, slug: 'Production' }),
    ).toThrow();
  });

  it('rejects a negative order', () => {
    expect(() => Environment.create({ ...baseProps, order: -1 })).toThrow();
  });

  it('rejects a non-integer order', () => {
    expect(() => Environment.create({ ...baseProps, order: 1.5 })).toThrow();
  });
});

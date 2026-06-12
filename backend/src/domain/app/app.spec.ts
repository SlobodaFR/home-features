import { App } from './app';

describe('App', () => {
  const baseProps = {
    id: 'app-1',
    userId: 'user-1',
    name: 'E-commerce Core',
    slug: 'ecommerce-core',
    description: null,
    createdAt: new Date('2026-01-01'),
  };

  it('creates a valid app', () => {
    const app = App.create(baseProps);
    expect(app.id).toBe('app-1');
    expect(app.slug).toBe('ecommerce-core');
  });

  it('rejects an empty name', () => {
    expect(() => App.create({ ...baseProps, name: '  ' })).toThrow();
  });

  it('rejects an invalid slug', () => {
    expect(() =>
      App.create({ ...baseProps, slug: 'Ecommerce Core' }),
    ).toThrow();
  });
});

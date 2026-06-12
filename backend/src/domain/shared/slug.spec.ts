import { Slug } from './slug';

describe('Slug', () => {
  it('accepts a valid slug', () => {
    const slug = Slug.create('new-checkout-flow');
    expect(slug.toString()).toBe('new-checkout-flow');
  });

  it('accepts a single-word slug', () => {
    expect(Slug.create('production').toString()).toBe('production');
  });

  it('rejects uppercase letters', () => {
    expect(() => Slug.create('New-Checkout')).toThrow();
  });

  it('rejects spaces', () => {
    expect(() => Slug.create('new checkout')).toThrow();
  });

  it('rejects leading/trailing hyphens', () => {
    expect(() => Slug.create('-checkout')).toThrow();
    expect(() => Slug.create('checkout-')).toThrow();
  });

  it('rejects consecutive hyphens', () => {
    expect(() => Slug.create('new--checkout')).toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => Slug.create('')).toThrow();
  });

  it('compares slugs by value', () => {
    expect(Slug.create('staging').equals(Slug.create('staging'))).toBe(true);
    expect(Slug.create('staging').equals(Slug.create('production'))).toBe(
      false,
    );
  });
});

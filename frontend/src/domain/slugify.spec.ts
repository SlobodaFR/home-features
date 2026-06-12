import { describe, expect, it } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('My Cool App')).toBe('my-cool-app');
  });

  it('collapses consecutive non-alphanumeric characters into a single hyphen', () => {
    expect(slugify('Foo   Bar---Baz!!')).toBe('foo-bar-baz');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  --Hello World--  ')).toBe('hello-world');
  });

  it('returns an empty string for blank input', () => {
    expect(slugify('   ')).toBe('');
  });

  it('keeps digits', () => {
    expect(slugify('App v2')).toBe('app-v2');
  });
});

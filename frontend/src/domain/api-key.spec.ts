import { describe, expect, it } from 'vitest';
import { API_KEY_SCOPES, apiKeyScopeHint, environmentNameOf } from './api-key';

describe('api-key', () => {
  it('offers the server and web scopes, server first', () => {
    expect(API_KEY_SCOPES).toEqual(['server', 'web']);
  });

  it('explains what each scope sees', () => {
    expect(apiKeyScopeHint('server')).toMatch(/every flag/i);
    expect(apiKeyScopeHint('web')).toMatch(/client-exposed/i);
  });

  it('names the environment a key is bound to', () => {
    const environments = [
      { id: 'e1', name: 'Production' },
      { id: 'e2', name: 'Staging' },
    ];

    expect(environmentNameOf('e2', environments)).toBe('Staging');
    expect(environmentNameOf('gone', environments)).toBe('Unknown');
  });
});

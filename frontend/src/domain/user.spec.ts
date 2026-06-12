import { describe, expect, it } from 'vitest';
import { CurrentUser } from './user';

describe('CurrentUser', () => {
  it('has the expected shape', () => {
    const user: CurrentUser = { id: 'user-1', email: 'john@example.com', name: 'John' };

    expect(user.id).toBe('user-1');
    expect(user.email).toBe('john@example.com');
    expect(user.name).toBe('John');
  });
});

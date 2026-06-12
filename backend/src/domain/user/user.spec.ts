import { User } from './user';

describe('User', () => {
  it('normalizes the email to lowercase', () => {
    const user = User.create({
      id: 'user-1',
      email: 'John.Doe@Example.com',
      name: 'John Doe',
      avatarUrl: 'https://example.com/avatar.png',
      createdAt: new Date(),
    });

    expect(user.email).toBe('john.doe@example.com');
  });

  it('rejects an invalid email address', () => {
    expect(() =>
      User.create({
        id: 'user-1',
        email: 'not-an-email',
        name: 'John Doe',
        avatarUrl: '',
        createdAt: new Date(),
      }),
    ).toThrow('Invalid email address');
  });

  it('returns a copy with the profile fields refreshed', () => {
    const user = User.create({
      id: 'user-1',
      email: 'john@example.com',
      name: 'John',
      avatarUrl: 'old.png',
      createdAt: new Date(),
    });

    const updated = user.withProfile({
      email: 'john2@example.com',
      name: 'John Two',
      avatarUrl: 'new.png',
    });

    expect(updated.id).toBe(user.id);
    expect(updated.email).toBe('john2@example.com');
    expect(updated.name).toBe('John Two');
    expect(updated.avatarUrl).toBe('new.png');
  });
});

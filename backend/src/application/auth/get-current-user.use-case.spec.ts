import { User } from '../../domain/user/user';
import { UserRepository } from '../../domain/user/user.repository';
import { GetCurrentUserUseCase } from './get-current-user.use-case';

const AUTH = 'https://auth.example.test';
const identity = { id: 'u1', email: 'john@example.com', name: 'John' };

function repo(avatarUrl: string | null): UserRepository {
  const user =
    avatarUrl === null
      ? null
      : User.create({ ...identity, avatarUrl, createdAt: new Date() });
  return {
    findById: () => Promise.resolve(user),
    findByEmail: () => Promise.resolve(user),
    save: () => Promise.resolve(),
  };
}

function build(avatarUrl: string | null, authUrl: string | undefined) {
  const warn = vi.fn<(message: string) => void>();
  return {
    warn,
    useCase: new GetCurrentUserUseCase(repo(avatarUrl), authUrl, { warn }),
  };
}

describe('GetCurrentUserUseCase', () => {
  it('returns the stored avatar when it is on the auth origin', async () => {
    const { useCase, warn } = build(`${AUTH}/avatars/u1`, `${AUTH}/some/path/`);
    await expect(useCase.execute(identity)).resolves.toEqual({
      ...identity,
      avatarUrl: `${AUTH}/avatars/u1`,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns null without warning when the user row is missing', async () => {
    const { useCase, warn } = build(null, AUTH);
    expect((await useCase.execute(identity)).avatarUrl).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it('returns null without warning for an empty avatar', async () => {
    const { useCase, warn } = build('', AUTH);
    expect((await useCase.execute(identity)).avatarUrl).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['foreign origin', 'https://evil.example/avatars/u1'],
    ['same host over http', 'http://auth.example.test/avatars/u1'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['relative URL', '/avatars/u1'],
  ])('returns null and warns once for %s', async (_label, url) => {
    const { useCase, warn } = build(url, AUTH);
    expect((await useCase.execute(identity)).avatarUrl).toBeNull();
    await useCase.execute(identity);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).not.toContain('u1');
  });

  it('returns null and warns when AUTH_SERVICE_URL is unset', async () => {
    const { useCase, warn } = build(`${AUTH}/avatars/u1`, undefined);
    expect((await useCase.execute(identity)).avatarUrl).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

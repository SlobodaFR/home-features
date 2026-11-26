import { MeController } from './me.controller';
import { GetCurrentUserUseCase } from '../../../application/auth/get-current-user.use-case';

describe('MeController', () => {
  it('wraps the current user, avatar included, under "user"', async () => {
    const view = {
      id: 'u1',
      email: 'john@example.com',
      name: 'John',
      avatarUrl: 'https://auth.example.test/avatars/u1',
    };
    const useCase = {
      execute: vi
        .fn<(user: object) => Promise<object>>()
        .mockResolvedValue(view),
    };
    const controller = new MeController(
      useCase as unknown as GetCurrentUserUseCase,
    );

    await expect(
      controller.me({ id: 'u1', email: 'john@example.com', name: 'John' }),
    ).resolves.toEqual({ user: view });
    expect(useCase.execute).toHaveBeenCalledWith({
      id: 'u1',
      email: 'john@example.com',
      name: 'John',
    });
  });
});

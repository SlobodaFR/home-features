import { Logger } from '@nestjs/common';
import { UserRepository } from '../../domain/user/user.repository';

export interface CurrentUserView {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface CurrentUserIdentity {
  id: string;
  email: string;
  name: string;
}

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { origin } = new URL(url);
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

/**
 * Identity (id, email, name) comes from the JWT; `avatarUrl` comes from the local user mirror,
 * refreshed at each OAuth callback. The URL is home-auth's `/avatars/:id`, which may 302 to a
 * third party (ui-avatars.com) for generated avatars. Only a URL on the auth service origin
 * reaches the browser: a stored value is never trusted blindly as an `<img src>`. The stored
 * URL is used (not rebuilt from the user id) so home-auth's route layout stays its own business.
 */
export class GetCurrentUserUseCase {
  private warned = false;

  constructor(
    private readonly users: UserRepository,
    private readonly authServiceUrl: string | undefined,
    private readonly logger: Pick<Logger, 'warn'> = new Logger(
      GetCurrentUserUseCase.name,
    ),
  ) {}

  async execute(identity: CurrentUserIdentity): Promise<CurrentUserView> {
    const stored = (await this.users.findById(identity.id))?.avatarUrl ?? '';
    return { ...identity, avatarUrl: this.safeAvatarUrl(stored) };
  }

  private safeAvatarUrl(stored: string): string | null {
    if (stored === '') return null;
    const expected = originOf(this.authServiceUrl);
    const actual = originOf(stored);
    if (expected !== null && actual === expected) return stored;
    if (!this.warned) {
      this.warned = true;
      this.logger.warn(
        `Avatar URL rejected: origin ${actual ?? 'invalid'} is not the auth service origin ${expected ?? 'unset'}`,
      );
    }
    return null;
  }
}

import { Controller, Get } from '@nestjs/common';
import { GetCurrentUserUseCase } from '../../../application/auth/get-current-user.use-case';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';

/** Authenticated endpoint used by the frontend: "Logged in as ..." and the app bar avatar. */
@Controller('me')
export class MeController {
  constructor(private readonly getCurrentUser: GetCurrentUserUseCase) {}

  @Get()
  async me(@CurrentUser() user: CurrentUserPayload) {
    return { user: await this.getCurrentUser.execute(user) };
  }
}

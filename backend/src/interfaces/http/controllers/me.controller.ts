import { Controller, Get } from '@nestjs/common';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';

/** Placeholder authenticated endpoint, used by the frontend to display "Logged in as ...". */
@Controller('me')
export class MeController {
  @Get()
  me(@CurrentUser() user: CurrentUserPayload) {
    return { user };
  }
}

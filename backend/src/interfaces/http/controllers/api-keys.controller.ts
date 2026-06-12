import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { DeleteApiKeyUseCase } from '../../../application/api-key/delete-api-key.use-case';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly deleteApiKey: DeleteApiKeyUseCase) {}

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.deleteApiKey.execute(id, user.id);
  }
}

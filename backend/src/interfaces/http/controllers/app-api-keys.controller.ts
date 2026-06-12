import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateApiKeyUseCase } from '../../../application/api-key/create-api-key.use-case';
import { ListApiKeysUseCase } from '../../../application/api-key/list-api-keys.use-case';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { SaveApiKeyDto } from '../dto/save-api-key.dto';

@Controller('apps/:appId/api-keys')
export class AppApiKeysController {
  constructor(
    private readonly listApiKeys: ListApiKeysUseCase,
    private readonly createApiKey: CreateApiKeyUseCase,
  ) {}

  @Get()
  list(@Param('appId') appId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.listApiKeys.execute(appId, user.id);
  }

  @Post()
  create(
    @Param('appId') appId: string,
    @Body() dto: SaveApiKeyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.createApiKey.execute(appId, dto.name, user.id);
  }
}

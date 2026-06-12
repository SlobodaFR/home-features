import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateConfigEntryUseCase } from '../../../application/config-entry/create-config-entry.use-case';
import { ListConfigEntriesUseCase } from '../../../application/config-entry/list-config-entries.use-case';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { SaveConfigEntryDto } from '../dto/save-config-entry.dto';

@Controller('apps/:appId/configs')
export class AppConfigsController {
  constructor(
    private readonly listConfigEntries: ListConfigEntriesUseCase,
    private readonly createConfigEntry: CreateConfigEntryUseCase,
  ) {}

  @Get()
  list(@Param('appId') appId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.listConfigEntries.execute(appId, user.id);
  }

  @Post()
  create(
    @Param('appId') appId: string,
    @Body() dto: SaveConfigEntryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.createConfigEntry.execute(
      appId,
      {
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type,
      },
      user.id,
    );
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateFeatureFlagUseCase } from '../../../application/feature-flag/create-feature-flag.use-case';
import { ListFeatureFlagsUseCase } from '../../../application/feature-flag/list-feature-flags.use-case';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { SaveFeatureFlagDto } from '../dto/save-feature-flag.dto';

@Controller('apps/:appId/flags')
export class AppFlagsController {
  constructor(
    private readonly listFeatureFlags: ListFeatureFlagsUseCase,
    private readonly createFeatureFlag: CreateFeatureFlagUseCase,
  ) {}

  @Get()
  list(@Param('appId') appId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.listFeatureFlags.execute(appId, user.id);
  }

  @Post()
  create(
    @Param('appId') appId: string,
    @Body() dto: SaveFeatureFlagDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.createFeatureFlag.execute(
      appId,
      {
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
      },
      user.id,
    );
  }
}

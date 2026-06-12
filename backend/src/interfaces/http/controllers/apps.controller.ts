import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateAppUseCase } from '../../../application/app/create-app.use-case';
import { DeleteAppUseCase } from '../../../application/app/delete-app.use-case';
import { GetAppUseCase } from '../../../application/app/get-app.use-case';
import { ListAppsUseCase } from '../../../application/app/list-apps.use-case';
import { UpdateAppUseCase } from '../../../application/app/update-app.use-case';
import { GetAppOverviewUseCase } from '../../../application/overview/get-app-overview.use-case';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { SaveAppDto } from '../dto/save-app.dto';

@Controller('apps')
export class AppsController {
  constructor(
    private readonly listApps: ListAppsUseCase,
    private readonly getApp: GetAppUseCase,
    private readonly createApp: CreateAppUseCase,
    private readonly updateApp: UpdateAppUseCase,
    private readonly deleteApp: DeleteAppUseCase,
    private readonly getAppOverview: GetAppOverviewUseCase,
  ) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.listApps.execute(user.id);
  }

  @Get(':appId')
  get(@Param('appId') appId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.getApp.execute(appId, user.id);
  }

  @Get(':appId/overview')
  overview(
    @Param('appId') appId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.getAppOverview.execute(appId, user.id);
  }

  @Post()
  create(@Body() dto: SaveAppDto, @CurrentUser() user: CurrentUserPayload) {
    return this.createApp.execute(
      {
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
      },
      user.id,
    );
  }

  @Patch(':appId')
  update(
    @Param('appId') appId: string,
    @Body() dto: SaveAppDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.updateApp.execute(
      appId,
      {
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
      },
      user.id,
    );
  }

  @Delete(':appId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('appId') appId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.deleteApp.execute(appId, user.id);
  }
}

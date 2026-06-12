import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CreateEnvironmentUseCase } from '../../../application/environment/create-environment.use-case';
import { ListEnvironmentsUseCase } from '../../../application/environment/list-environments.use-case';
import { ReorderEnvironmentsUseCase } from '../../../application/environment/reorder-environments.use-case';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { ReorderEnvironmentsDto } from '../dto/reorder-environments.dto';
import { SaveEnvironmentDto } from '../dto/save-environment.dto';

@Controller('apps/:appId/environments')
export class AppEnvironmentsController {
  constructor(
    private readonly listEnvironments: ListEnvironmentsUseCase,
    private readonly createEnvironment: CreateEnvironmentUseCase,
    private readonly reorderEnvironments: ReorderEnvironmentsUseCase,
  ) {}

  @Get()
  list(@Param('appId') appId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.listEnvironments.execute(appId, user.id);
  }

  @Post()
  create(
    @Param('appId') appId: string,
    @Body() dto: SaveEnvironmentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.createEnvironment.execute(
      appId,
      { name: dto.name, slug: dto.slug },
      user.id,
    );
  }

  @Put('reorder')
  reorder(
    @Param('appId') appId: string,
    @Body() dto: ReorderEnvironmentsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reorderEnvironments.execute(appId, dto.environmentIds, user.id);
  }
}

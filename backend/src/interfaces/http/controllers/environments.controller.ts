import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import { DeleteEnvironmentUseCase } from '../../../application/environment/delete-environment.use-case';
import { UpdateEnvironmentUseCase } from '../../../application/environment/update-environment.use-case';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { SaveEnvironmentDto } from '../dto/save-environment.dto';

@Controller('environments')
export class EnvironmentsController {
  constructor(
    private readonly updateEnvironment: UpdateEnvironmentUseCase,
    private readonly deleteEnvironment: DeleteEnvironmentUseCase,
  ) {}

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: SaveEnvironmentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.updateEnvironment.execute(
      id,
      { name: dto.name, slug: dto.slug },
      user.id,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.deleteEnvironment.execute(id, user.id);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
} from '@nestjs/common';
import { DeleteFeatureFlagUseCase } from '../../../application/feature-flag/delete-feature-flag.use-case';
import { ListFlagHistoryUseCase } from '../../../application/feature-flag/list-flag-history.use-case';
import { SetFlagValueUseCase } from '../../../application/feature-flag/set-flag-value.use-case';
import { UpdateFeatureFlagUseCase } from '../../../application/feature-flag/update-feature-flag.use-case';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import {
  DeleteFeatureFlagDto,
  UpdateFeatureFlagDto,
} from '../dto/save-feature-flag.dto';
import { SetFlagValueDto } from '../dto/set-flag-value.dto';

@Controller('flags')
export class FlagsController {
  constructor(
    private readonly updateFeatureFlag: UpdateFeatureFlagUseCase,
    private readonly deleteFeatureFlag: DeleteFeatureFlagUseCase,
    private readonly setFlagValue: SetFlagValueUseCase,
    private readonly listFlagHistory: ListFlagHistoryUseCase,
  ) {}

  @Get(':id/history')
  history(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.listFlagHistory.execute(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.updateFeatureFlag.execute(
      id,
      {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        clientExposed: dto.clientExposed,
      },
      user.id,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    // No body at all is allowed (ValidationPipe turns it into an empty DTO): a flag that is off
    // everywhere needs no confirmation. Keep the plain class type so the DTO is validated.
    @Body() dto: DeleteFeatureFlagDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.deleteFeatureFlag.execute(id, dto.confirm, user.id);
  }

  @Put(':id/values/:environmentId')
  setValue(
    @Param('id') id: string,
    @Param('environmentId') environmentId: string,
    @Body() dto: SetFlagValueDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.setFlagValue.execute(id, environmentId, dto.enabled, user);
  }
}

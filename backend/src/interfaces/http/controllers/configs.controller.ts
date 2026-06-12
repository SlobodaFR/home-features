import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
} from '@nestjs/common';
import { DeleteConfigEntryUseCase } from '../../../application/config-entry/delete-config-entry.use-case';
import { SetConfigValueUseCase } from '../../../application/config-entry/set-config-value.use-case';
import { UpdateConfigEntryUseCase } from '../../../application/config-entry/update-config-entry.use-case';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { SaveConfigEntryDto } from '../dto/save-config-entry.dto';
import { SetConfigValueDto } from '../dto/set-config-value.dto';

@Controller('configs')
export class ConfigsController {
  constructor(
    private readonly updateConfigEntry: UpdateConfigEntryUseCase,
    private readonly deleteConfigEntry: DeleteConfigEntryUseCase,
    private readonly setConfigValue: SetConfigValueUseCase,
  ) {}

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: SaveConfigEntryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.updateConfigEntry.execute(
      id,
      {
        key: dto.key,
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type,
      },
      user.id,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.deleteConfigEntry.execute(id, user.id);
  }

  @Put(':id/values/:environmentId')
  setValue(
    @Param('id') id: string,
    @Param('environmentId') environmentId: string,
    @Body() dto: SetConfigValueDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.setConfigValue.execute(id, environmentId, dto.value, user.id);
  }
}

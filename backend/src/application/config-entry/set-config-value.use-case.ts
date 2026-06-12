import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppRepository } from '../../domain/app/app.repository';
import { ConfigEntryRepository } from '../../domain/config-entry/config-entry.repository';
import { ConfigValue } from '../../domain/config-entry/config-value';
import { ConfigValueRepository } from '../../domain/config-entry/config-value.repository';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { assertConfigEntryOwnership } from './assert-config-entry-ownership';
import { ConfigValueDto } from './config-entry.dto';
import { toConfigValueDto } from './to-config-entry-dto';

@Injectable()
export class SetConfigValueUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly configEntryRepository: ConfigEntryRepository,
    private readonly environmentRepository: EnvironmentRepository,
    private readonly configValueRepository: ConfigValueRepository,
  ) {}

  async execute(
    configEntryId: string,
    environmentId: string,
    value: string,
    userId: string,
  ): Promise<ConfigValueDto> {
    const configEntry = await assertConfigEntryOwnership(
      this.configEntryRepository,
      this.appRepository,
      configEntryId,
      userId,
    );

    const environment =
      await this.environmentRepository.findById(environmentId);
    if (!environment || environment.appId !== configEntry.appId) {
      throw new NotFoundException(`Environment ${environmentId} not found`);
    }

    let configValue: ConfigValue;
    try {
      configValue = ConfigValue.create({
        id: randomUUID(),
        configEntryId,
        environmentId,
        value,
        type: configEntry.type,
        updatedAt: new Date(),
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid config value',
      );
    }

    const saved = await this.configValueRepository.upsert(configValue);

    return toConfigValueDto(saved);
  }
}

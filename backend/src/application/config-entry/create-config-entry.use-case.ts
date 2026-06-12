import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppRepository } from '../../domain/app/app.repository';
import { ConfigEntry } from '../../domain/config-entry/config-entry';
import { ConfigEntryRepository } from '../../domain/config-entry/config-entry.repository';
import { assertAppOwnership } from '../app/assert-app-ownership';
import { ConfigEntryDto } from './config-entry.dto';
import { ConfigEntryInput } from './config-entry-input.dto';
import { toConfigEntryDto } from './to-config-entry-dto';

@Injectable()
export class CreateConfigEntryUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly configEntryRepository: ConfigEntryRepository,
  ) {}

  async execute(
    appId: string,
    input: ConfigEntryInput,
    userId: string,
  ): Promise<ConfigEntryDto> {
    await assertAppOwnership(this.appRepository, appId, userId);

    const existing = await this.configEntryRepository.findByKey(
      appId,
      input.key,
    );
    if (existing) {
      throw new ConflictException(
        'A config entry with this key already exists for this app',
      );
    }

    let configEntry: ConfigEntry;
    try {
      configEntry = ConfigEntry.create({
        id: randomUUID(),
        appId,
        key: input.key,
        name: input.name,
        description: input.description,
        type: input.type,
        createdAt: new Date(),
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid config entry',
      );
    }

    await this.configEntryRepository.save(configEntry);

    return toConfigEntryDto(configEntry);
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { ConfigEntry } from '../../domain/config-entry/config-entry';
import { ConfigEntryRepository } from '../../domain/config-entry/config-entry.repository';
import { assertConfigEntryOwnership } from './assert-config-entry-ownership';
import { ConfigEntryDto } from './config-entry.dto';
import { ConfigEntryInput } from './config-entry-input.dto';
import { toConfigEntryDto } from './to-config-entry-dto';

/**
 * Note: changing `type` does not retroactively re-validate existing
 * ConfigValues. The next time a value is set, it is validated against the
 * new type.
 */
@Injectable()
export class UpdateConfigEntryUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly configEntryRepository: ConfigEntryRepository,
  ) {}

  async execute(
    id: string,
    input: ConfigEntryInput,
    userId: string,
  ): Promise<ConfigEntryDto> {
    const existing = await assertConfigEntryOwnership(
      this.configEntryRepository,
      this.appRepository,
      id,
      userId,
    );

    const conflict = await this.configEntryRepository.findByKey(
      existing.appId,
      input.key,
    );
    if (conflict && conflict.id !== id) {
      throw new ConflictException(
        'A config entry with this key already exists for this app',
      );
    }

    let configEntry: ConfigEntry;
    try {
      configEntry = ConfigEntry.create({
        id: existing.id,
        appId: existing.appId,
        key: input.key,
        name: input.name,
        description: input.description,
        type: input.type,
        createdAt: existing.createdAt,
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

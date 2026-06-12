import { Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { ConfigEntryRepository } from '../../domain/config-entry/config-entry.repository';
import { ConfigValueRepository } from '../../domain/config-entry/config-value.repository';
import { assertAppOwnership } from '../app/assert-app-ownership';
import { ConfigEntryWithValuesDto } from './config-entry.dto';
import { toConfigEntryWithValuesDto } from './to-config-entry-dto';

@Injectable()
export class ListConfigEntriesUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly configEntryRepository: ConfigEntryRepository,
    private readonly configValueRepository: ConfigValueRepository,
  ) {}

  async execute(
    appId: string,
    userId: string,
  ): Promise<ConfigEntryWithValuesDto[]> {
    await assertAppOwnership(this.appRepository, appId, userId);

    const configEntries =
      await this.configEntryRepository.findAllByAppId(appId);
    const values = await this.configValueRepository.findAllByAppId(appId);

    return configEntries.map((configEntry) =>
      toConfigEntryWithValuesDto(
        configEntry,
        values.filter((value) => value.configEntryId === configEntry.id),
      ),
    );
  }
}

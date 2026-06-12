import { NotFoundException } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { ConfigEntry } from '../../domain/config-entry/config-entry';
import { ConfigEntryRepository } from '../../domain/config-entry/config-entry.repository';

/**
 * Loads the ConfigEntry by id and verifies its parent App belongs to
 * `userId`. Throws NotFoundException (404) otherwise.
 */
export async function assertConfigEntryOwnership(
  configEntryRepository: ConfigEntryRepository,
  appRepository: AppRepository,
  configEntryId: string,
  userId: string,
): Promise<ConfigEntry> {
  const configEntry = await configEntryRepository.findById(configEntryId);
  if (!configEntry) {
    throw new NotFoundException(`Config entry ${configEntryId} not found`);
  }

  const app = await appRepository.findById(configEntry.appId);
  if (!app || app.userId !== userId) {
    throw new NotFoundException(`Config entry ${configEntryId} not found`);
  }

  return configEntry;
}

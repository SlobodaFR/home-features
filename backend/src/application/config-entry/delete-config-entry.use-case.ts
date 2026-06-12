import { Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { ConfigEntryRepository } from '../../domain/config-entry/config-entry.repository';
import { assertConfigEntryOwnership } from './assert-config-entry-ownership';

/**
 * Deleting a ConfigEntry cascades to its config values via SQLite FK
 * `ON DELETE CASCADE`.
 */
@Injectable()
export class DeleteConfigEntryUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly configEntryRepository: ConfigEntryRepository,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    await assertConfigEntryOwnership(
      this.configEntryRepository,
      this.appRepository,
      id,
      userId,
    );
    await this.configEntryRepository.delete(id);
  }
}

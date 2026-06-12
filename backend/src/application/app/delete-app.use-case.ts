import { Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { assertAppOwnership } from './assert-app-ownership';

/**
 * Deleting an App cascades to its environments, feature flags, flag values,
 * config entries and config values via SQLite FK `ON DELETE CASCADE`
 * (foreign_keys is enabled by the better-sqlite3 driver).
 */
@Injectable()
export class DeleteAppUseCase {
  constructor(private readonly appRepository: AppRepository) {}

  async execute(id: string, userId: string): Promise<void> {
    await assertAppOwnership(this.appRepository, id, userId);
    await this.appRepository.delete(id);
  }
}

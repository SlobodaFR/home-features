import { Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { assertEnvironmentOwnership } from './assert-environment-ownership';

/**
 * Deleting an Environment cascades to its flag values and config values via
 * SQLite FK `ON DELETE CASCADE`.
 */
@Injectable()
export class DeleteEnvironmentUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly environmentRepository: EnvironmentRepository,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    await assertEnvironmentOwnership(
      this.environmentRepository,
      this.appRepository,
      id,
      userId,
    );
    await this.environmentRepository.delete(id);
  }
}

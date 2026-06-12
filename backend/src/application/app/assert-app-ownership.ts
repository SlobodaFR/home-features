import { NotFoundException } from '@nestjs/common';
import { App } from '../../domain/app/app';
import { AppRepository } from '../../domain/app/app.repository';

/**
 * Loads the App by id and verifies it belongs to `userId`. Throws
 * NotFoundException (404) if the app does not exist or belongs to another
 * user - we deliberately do not leak existence with a 403.
 */
export async function assertAppOwnership(
  appRepository: AppRepository,
  appId: string,
  userId: string,
): Promise<App> {
  const app = await appRepository.findById(appId);
  if (!app || app.userId !== userId) {
    throw new NotFoundException(`App ${appId} not found`);
  }
  return app;
}

import { NotFoundException } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { Environment } from '../../domain/environment/environment';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';

/**
 * Loads the Environment by id and verifies its parent App belongs to
 * `userId`. Throws NotFoundException (404) otherwise.
 */
export async function assertEnvironmentOwnership(
  environmentRepository: EnvironmentRepository,
  appRepository: AppRepository,
  environmentId: string,
  userId: string,
): Promise<Environment> {
  const environment = await environmentRepository.findById(environmentId);
  if (!environment) {
    throw new NotFoundException(`Environment ${environmentId} not found`);
  }

  const app = await appRepository.findById(environment.appId);
  if (!app || app.userId !== userId) {
    throw new NotFoundException(`Environment ${environmentId} not found`);
  }

  return environment;
}

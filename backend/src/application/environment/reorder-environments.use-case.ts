import { BadRequestException, Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { Environment } from '../../domain/environment/environment';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { assertAppOwnership } from '../app/assert-app-ownership';
import { EnvironmentDto } from './environment.dto';
import { toEnvironmentDto } from './to-environment-dto';

/**
 * Reassigns the `order` of every environment of an app according to the
 * given ordered list of environment ids. All of the app's environment ids
 * must be present exactly once.
 */
@Injectable()
export class ReorderEnvironmentsUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly environmentRepository: EnvironmentRepository,
  ) {}

  async execute(
    appId: string,
    orderedEnvironmentIds: string[],
    userId: string,
  ): Promise<EnvironmentDto[]> {
    await assertAppOwnership(this.appRepository, appId, userId);

    const environments = await this.environmentRepository.findAllByAppId(appId);

    const knownIds = new Set(environments.map((env) => env.id));
    const providedIds = new Set(orderedEnvironmentIds);
    if (
      orderedEnvironmentIds.length !== environments.length ||
      knownIds.size !== providedIds.size ||
      ![...knownIds].every((id) => providedIds.has(id))
    ) {
      throw new BadRequestException(
        'The provided environment ids must match exactly the app environments',
      );
    }

    const byId = new Map(environments.map((env) => [env.id, env]));
    const reordered = orderedEnvironmentIds.map((id, index) =>
      Environment.create({
        id,
        appId: byId.get(id)!.appId,
        name: byId.get(id)!.name,
        slug: byId.get(id)!.slug,
        order: index,
        createdAt: byId.get(id)!.createdAt,
      }),
    );

    await this.environmentRepository.saveAll(reordered);

    return reordered.map(toEnvironmentDto);
  }
}

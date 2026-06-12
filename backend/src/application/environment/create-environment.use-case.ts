import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AppRepository } from '../../domain/app/app.repository';
import { Environment } from '../../domain/environment/environment';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { assertAppOwnership } from '../app/assert-app-ownership';
import { EnvironmentDto } from './environment.dto';
import { EnvironmentInput } from './environment-input.dto';
import { toEnvironmentDto } from './to-environment-dto';

@Injectable()
export class CreateEnvironmentUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly environmentRepository: EnvironmentRepository,
  ) {}

  async execute(
    appId: string,
    input: EnvironmentInput,
    userId: string,
  ): Promise<EnvironmentDto> {
    await assertAppOwnership(this.appRepository, appId, userId);

    const existing = await this.environmentRepository.findBySlug(
      appId,
      input.slug,
    );
    if (existing) {
      throw new ConflictException(
        'An environment with this slug already exists for this app',
      );
    }

    const environments = await this.environmentRepository.findAllByAppId(appId);
    const nextOrder =
      environments.reduce((max, env) => Math.max(max, env.order), -1) + 1;

    let environment: Environment;
    try {
      environment = Environment.create({
        id: randomUUID(),
        appId,
        name: input.name,
        slug: input.slug,
        order: nextOrder,
        createdAt: new Date(),
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid environment',
      );
    }

    await this.environmentRepository.save(environment);

    return toEnvironmentDto(environment);
  }
}

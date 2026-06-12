import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { Environment } from '../../domain/environment/environment';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { assertEnvironmentOwnership } from './assert-environment-ownership';
import { EnvironmentDto } from './environment.dto';
import { EnvironmentInput } from './environment-input.dto';
import { toEnvironmentDto } from './to-environment-dto';

@Injectable()
export class UpdateEnvironmentUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly environmentRepository: EnvironmentRepository,
  ) {}

  async execute(
    id: string,
    input: EnvironmentInput,
    userId: string,
  ): Promise<EnvironmentDto> {
    const existing = await assertEnvironmentOwnership(
      this.environmentRepository,
      this.appRepository,
      id,
      userId,
    );

    const conflict = await this.environmentRepository.findBySlug(
      existing.appId,
      input.slug,
    );
    if (conflict && conflict.id !== id) {
      throw new ConflictException(
        'An environment with this slug already exists for this app',
      );
    }

    let environment: Environment;
    try {
      environment = Environment.create({
        id: existing.id,
        appId: existing.appId,
        name: input.name,
        slug: input.slug,
        order: existing.order,
        createdAt: existing.createdAt,
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

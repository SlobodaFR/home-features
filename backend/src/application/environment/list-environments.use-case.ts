import { Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { assertAppOwnership } from '../app/assert-app-ownership';
import { EnvironmentDto } from './environment.dto';
import { toEnvironmentDto } from './to-environment-dto';

@Injectable()
export class ListEnvironmentsUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly environmentRepository: EnvironmentRepository,
  ) {}

  async execute(appId: string, userId: string): Promise<EnvironmentDto[]> {
    await assertAppOwnership(this.appRepository, appId, userId);

    const environments = await this.environmentRepository.findAllByAppId(appId);
    return environments.map(toEnvironmentDto);
  }
}

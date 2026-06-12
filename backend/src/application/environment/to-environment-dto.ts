import { Environment } from '../../domain/environment/environment';
import { EnvironmentDto } from './environment.dto';

export function toEnvironmentDto(environment: Environment): EnvironmentDto {
  return {
    id: environment.id,
    appId: environment.appId,
    name: environment.name,
    slug: environment.slug,
    order: environment.order,
    createdAt: environment.createdAt.toISOString(),
  };
}

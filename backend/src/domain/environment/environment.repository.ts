import { Environment } from './environment';

/**
 * Port (driven side) implemented by the infrastructure layer.
 */
export abstract class EnvironmentRepository {
  abstract findAllByAppId(appId: string): Promise<Environment[]>;
  abstract findById(id: string): Promise<Environment | null>;
  abstract findBySlug(appId: string, slug: string): Promise<Environment | null>;
  abstract save(environment: Environment): Promise<void>;
  abstract saveAll(environments: Environment[]): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

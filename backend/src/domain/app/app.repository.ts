import { App } from './app';

/**
 * Port (driven side) implemented by the infrastructure layer.
 */
export abstract class AppRepository {
  abstract findAll(userId: string): Promise<App[]>;
  abstract findById(id: string): Promise<App | null>;
  abstract findByNameOrSlug(
    userId: string,
    name: string,
    slug: string,
  ): Promise<App | null>;
  abstract save(app: App): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

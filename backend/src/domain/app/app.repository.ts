import { App } from './app';

/**
 * Port (driven side) implemented by the infrastructure layer.
 */
export abstract class AppRepository {
  abstract findAll(userId: string): Promise<App[]>;
  abstract findById(id: string): Promise<App | null>;
  /** Every app with this slug, whatever its owner (slugs are unique per owner only). */
  abstract findAllBySlug(slug: string): Promise<App[]>;
  abstract findByNameOrSlug(
    userId: string,
    name: string,
    slug: string,
  ): Promise<App | null>;
  abstract save(app: App): Promise<void>;
  abstract delete(id: string): Promise<void>;
}

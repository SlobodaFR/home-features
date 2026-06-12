import { App } from '../../domain/app/app';
import { AppRepository } from '../../domain/app/app.repository';
import { CreateAppUseCase } from './create-app.use-case';

class InMemoryAppRepository extends AppRepository {
  apps: App[] = [];

  async findAll(userId: string): Promise<App[]> {
    return this.apps.filter((app) => app.userId === userId);
  }

  async findById(id: string): Promise<App | null> {
    return this.apps.find((app) => app.id === id) ?? null;
  }

  async findByNameOrSlug(
    userId: string,
    name: string,
    slug: string,
  ): Promise<App | null> {
    return (
      this.apps.find(
        (app) =>
          app.userId === userId && (app.name === name || app.slug === slug),
      ) ?? null
    );
  }

  async save(app: App): Promise<void> {
    this.apps = this.apps.filter((existing) => existing.id !== app.id);
    this.apps.push(app);
  }

  async delete(id: string): Promise<void> {
    this.apps = this.apps.filter((app) => app.id !== id);
  }
}

describe('CreateAppUseCase', () => {
  it('creates a new app', async () => {
    const repository = new InMemoryAppRepository();
    const useCase = new CreateAppUseCase(repository);

    const dto = await useCase.execute(
      { name: 'E-commerce Core', slug: 'ecommerce-core', description: null },
      'user-1',
    );

    expect(dto.name).toBe('E-commerce Core');
    expect(dto.slug).toBe('ecommerce-core');
    expect(repository.apps).toHaveLength(1);
  });

  it('rejects an invalid slug with a 400', async () => {
    const repository = new InMemoryAppRepository();
    const useCase = new CreateAppUseCase(repository);

    await expect(
      useCase.execute(
        { name: 'E-commerce Core', slug: 'Invalid Slug', description: null },
        'user-1',
      ),
    ).rejects.toThrow();
  });

  it('rejects a duplicate name/slug for the same user with a 409', async () => {
    const repository = new InMemoryAppRepository();
    const useCase = new CreateAppUseCase(repository);

    await useCase.execute(
      { name: 'E-commerce Core', slug: 'ecommerce-core', description: null },
      'user-1',
    );

    await expect(
      useCase.execute(
        { name: 'E-commerce Core', slug: 'another-slug', description: null },
        'user-1',
      ),
    ).rejects.toThrow();

    await expect(
      useCase.execute(
        { name: 'Another Name', slug: 'ecommerce-core', description: null },
        'user-1',
      ),
    ).rejects.toThrow();
  });

  it('allows the same name/slug across different users', async () => {
    const repository = new InMemoryAppRepository();
    const useCase = new CreateAppUseCase(repository);

    await useCase.execute(
      { name: 'E-commerce Core', slug: 'ecommerce-core', description: null },
      'user-1',
    );

    await expect(
      useCase.execute(
        { name: 'E-commerce Core', slug: 'ecommerce-core', description: null },
        'user-2',
      ),
    ).resolves.toBeDefined();
  });
});

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Environment } from '../../../domain/environment/environment';
import { EnvironmentRepository } from '../../../domain/environment/environment.repository';
import { EnvironmentOrmEntity } from '../entities/environment.orm-entity';

@Injectable()
export class TypeOrmEnvironmentRepository extends EnvironmentRepository {
  constructor(
    @InjectRepository(EnvironmentOrmEntity)
    private readonly repository: Repository<EnvironmentOrmEntity>,
  ) {
    super();
  }

  async findAllByAppId(appId: string): Promise<Environment[]> {
    const rows = await this.repository.find({
      where: { appId },
      order: { order: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Environment | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findBySlug(appId: string, slug: string): Promise<Environment | null> {
    const row = await this.repository.findOne({ where: { appId, slug } });
    return row ? toDomain(row) : null;
  }

  async save(environment: Environment): Promise<void> {
    await this.repository.save({
      id: environment.id,
      appId: environment.appId,
      name: environment.name,
      slug: environment.slug,
      order: environment.order,
      createdAt: environment.createdAt,
    });
  }

  async saveAll(environments: Environment[]): Promise<void> {
    await this.repository.save(
      environments.map((environment) => ({
        id: environment.id,
        appId: environment.appId,
        name: environment.name,
        slug: environment.slug,
        order: environment.order,
        createdAt: environment.createdAt,
      })),
    );
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}

function toDomain(row: EnvironmentOrmEntity): Environment {
  return Environment.create({
    id: row.id,
    appId: row.appId,
    name: row.name,
    slug: row.slug,
    order: row.order,
    createdAt: new Date(row.createdAt),
  });
}

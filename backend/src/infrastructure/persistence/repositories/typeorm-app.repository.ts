import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { App } from '../../../domain/app/app';
import { AppRepository } from '../../../domain/app/app.repository';
import { AppOrmEntity } from '../entities/app.orm-entity';

@Injectable()
export class TypeOrmAppRepository extends AppRepository {
  constructor(
    @InjectRepository(AppOrmEntity)
    private readonly repository: Repository<AppOrmEntity>,
  ) {
    super();
  }

  async findAll(userId: string): Promise<App[]> {
    const rows = await this.repository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<App | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByNameOrSlug(
    userId: string,
    name: string,
    slug: string,
  ): Promise<App | null> {
    const row = await this.repository
      .createQueryBuilder('app')
      .where('app.user_id = :userId', { userId })
      .andWhere('(app.name = :name OR app.slug = :slug)', { name, slug })
      .getOne();
    return row ? toDomain(row) : null;
  }

  async save(app: App): Promise<void> {
    await this.repository.save({
      id: app.id,
      userId: app.userId,
      name: app.name,
      slug: app.slug,
      description: app.description,
      createdAt: app.createdAt,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}

function toDomain(row: AppOrmEntity): App {
  return App.create({
    id: row.id,
    userId: row.userId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: new Date(row.createdAt),
  });
}

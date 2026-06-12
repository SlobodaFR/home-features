import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'apps' })
@Index(['userId', 'name'], { unique: true })
@Index(['userId', 'slug'], { unique: true })
export class AppOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Index()
  @Column({ type: 'text', name: 'user_id' })
  userId!: string;

  @Column('text')
  name!: string;

  @Column('text')
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}

import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { AppOrmEntity } from './app.orm-entity';

@Entity({ name: 'environments' })
@Index(['appId', 'slug'], { unique: true })
export class EnvironmentOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Index()
  @Column({ type: 'text', name: 'app_id' })
  appId!: string;

  @ManyToOne(() => AppOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_id' })
  app!: AppOrmEntity;

  @Column('text')
  name!: string;

  @Column('text')
  slug!: string;

  @Column('integer')
  order!: number;

  @Column({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}

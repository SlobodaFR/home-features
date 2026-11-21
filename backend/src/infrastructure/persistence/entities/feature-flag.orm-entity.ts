import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { AppOrmEntity } from './app.orm-entity';

@Entity({ name: 'feature_flags' })
@Index(['appId', 'key'], { unique: true })
export class FeatureFlagOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Index()
  @Column({ type: 'text', name: 'app_id' })
  appId!: string;

  @ManyToOne(() => AppOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_id' })
  app!: AppOrmEntity;

  @Column('text')
  key!: string;

  @Column('text')
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'boolean', name: 'client_exposed', default: false })
  clientExposed!: boolean;

  @Column({ type: 'datetime', name: 'last_evaluated_at', nullable: true })
  lastEvaluatedAt!: Date | null;
}

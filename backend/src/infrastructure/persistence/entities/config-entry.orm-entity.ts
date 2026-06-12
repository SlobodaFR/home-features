import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ConfigValueType } from '../../../domain/config-entry/config-value-type.enum';
import { AppOrmEntity } from './app.orm-entity';

@Entity({ name: 'config_entries' })
@Index(['appId', 'key'], { unique: true })
export class ConfigEntryOrmEntity {
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

  @Column('text')
  type!: ConfigValueType;

  @Column({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}

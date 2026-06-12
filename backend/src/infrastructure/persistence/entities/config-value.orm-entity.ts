import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ConfigEntryOrmEntity } from './config-entry.orm-entity';
import { EnvironmentOrmEntity } from './environment.orm-entity';

@Entity({ name: 'config_values' })
@Index(['configEntryId', 'environmentId'], { unique: true })
export class ConfigValueOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Index()
  @Column({ type: 'text', name: 'config_entry_id' })
  configEntryId!: string;

  @ManyToOne(() => ConfigEntryOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'config_entry_id' })
  configEntry!: ConfigEntryOrmEntity;

  @Index()
  @Column({ type: 'text', name: 'environment_id' })
  environmentId!: string;

  @ManyToOne(() => EnvironmentOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'environment_id' })
  environment!: EnvironmentOrmEntity;

  @Column('text')
  value!: string;

  @Column({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}

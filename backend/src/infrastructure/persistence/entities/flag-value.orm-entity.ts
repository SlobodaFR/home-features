import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { EnvironmentOrmEntity } from './environment.orm-entity';
import { FeatureFlagOrmEntity } from './feature-flag.orm-entity';

@Entity({ name: 'flag_values' })
@Index(['flagId', 'environmentId'], { unique: true })
export class FlagValueOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Index()
  @Column({ type: 'text', name: 'flag_id' })
  flagId!: string;

  @ManyToOne(() => FeatureFlagOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flag_id' })
  flag!: FeatureFlagOrmEntity;

  @Index()
  @Column({ type: 'text', name: 'environment_id' })
  environmentId!: string;

  @ManyToOne(() => EnvironmentOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'environment_id' })
  environment!: EnvironmentOrmEntity;

  @Column('boolean')
  enabled!: boolean;

  @Column({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}

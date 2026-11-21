import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { AppOrmEntity } from './app.orm-entity';
import { EnvironmentOrmEntity } from './environment.orm-entity';

@Entity({ name: 'api_keys' })
export class ApiKeyOrmEntity {
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

  @Index({ unique: true })
  @Column({ type: 'text', name: 'key_hash' })
  keyHash!: string;

  @Column({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'datetime', name: 'last_used_at', nullable: true })
  lastUsedAt!: Date | null;

  // Nullable in SQL only because ALTER TABLE ADD COLUMN cannot add a NOT NULL foreign key: the
  // migration deleted every unbound key and the ApiKey domain refuses one.
  @Index()
  @Column({ type: 'text', name: 'environment_id', nullable: true })
  environmentId!: string | null;

  @ManyToOne(() => EnvironmentOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'environment_id' })
  environment!: EnvironmentOrmEntity | null;

  @Column({ type: 'text', default: 'server' })
  scope!: string;
}

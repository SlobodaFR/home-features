import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Append-only journal (UPDATE and DELETE are refused by triggers, see the FlagValueChanges
 * migration). No foreign keys on purpose: the history of a deleted flag or environment stays.
 */
@Entity({ name: 'flag_value_changes' })
@Check('CHK_flag_value_changes_source', `"source" IN ('ui', 'cli')`)
@Index(['flagId', 'at'])
export class FlagValueChangeOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Column({ type: 'text', name: 'flag_id' })
  flagId!: string;

  @Column({ type: 'text', name: 'environment_id' })
  environmentId!: string;

  @Column({ type: 'boolean', name: 'old_enabled', nullable: true })
  oldEnabled!: boolean | null;

  @Column({ type: 'boolean', name: 'new_enabled' })
  newEnabled!: boolean;

  @Column('text')
  actor!: string;

  @Column('text')
  source!: string;

  @Column('datetime')
  at!: Date;
}

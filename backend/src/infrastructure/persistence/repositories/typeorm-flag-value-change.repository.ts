import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FlagValueChange,
  FlagValueChangeSource,
} from '../../../domain/feature-flag/flag-value-change';
import { FlagValueChangeRepository } from '../../../domain/feature-flag/flag-value-change.repository';
import { FlagValueChangeOrmEntity } from '../entities/flag-value-change.orm-entity';

@Injectable()
export class TypeOrmFlagValueChangeRepository extends FlagValueChangeRepository {
  constructor(
    @InjectRepository(FlagValueChangeOrmEntity)
    private readonly repository: Repository<FlagValueChangeOrmEntity>,
  ) {
    super();
  }

  async findLatestByFlagId(
    flagId: string,
    limit: number,
  ): Promise<FlagValueChange[]> {
    const rows = await this.repository
      .createQueryBuilder('change')
      .where('change.flag_id = :flagId', { flagId })
      .orderBy('change.at', 'DESC')
      // Insertion order breaks ties between changes written in the same millisecond.
      .addOrderBy('change.rowid', 'DESC')
      .limit(limit)
      .getMany();
    return rows.map((row) =>
      FlagValueChange.create({
        id: row.id,
        flagId: row.flagId,
        environmentId: row.environmentId,
        oldEnabled: row.oldEnabled,
        newEnabled: row.newEnabled,
        actor: row.actor,
        source: row.source as FlagValueChangeSource,
        at: new Date(row.at),
      }),
    );
  }
}

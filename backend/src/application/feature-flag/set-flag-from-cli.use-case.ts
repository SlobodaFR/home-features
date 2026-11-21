import { Injectable } from '@nestjs/common';
import { AppRepository } from '../../domain/app/app.repository';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { ChangeFlagValueService } from './change-flag-value.service';

export interface SetFlagFromCliInput {
  appSlug: string;
  environmentSlug: string;
  flagKey: string;
  enabled: boolean;
  actor: string;
}

export type SetFlagFromCliResult =
  | { status: 'changed'; previous: boolean | null }
  | { status: 'unchanged' }
  | { status: 'error'; message: string };

/**
 * Emergency path without UI nor home-auth (run inside the container). No ownership check: whoever
 * can exec into the container already has the database. Goes through ChangeFlagValueService like
 * the UI: same transaction, journal entry (source cli) and log line.
 */
@Injectable()
export class SetFlagFromCliUseCase {
  constructor(
    private readonly appRepository: AppRepository,
    private readonly environmentRepository: EnvironmentRepository,
    private readonly flagRepository: FeatureFlagRepository,
    private readonly changeFlagValue: ChangeFlagValueService,
  ) {}

  async execute(input: SetFlagFromCliInput): Promise<SetFlagFromCliResult> {
    // App slugs are unique per owner only.
    const apps = await this.appRepository.findAllBySlug(input.appSlug);
    if (apps.length === 0) {
      return { status: 'error', message: `App "${input.appSlug}" not found` };
    }
    if (apps.length > 1) {
      return {
        status: 'error',
        message: `App slug "${input.appSlug}" is ambiguous: ${apps.length.toString()} apps (ids ${apps.map((app) => app.id).join(', ')}) share it`,
      };
    }
    const [app] = apps;
    const environment = await this.environmentRepository.findBySlug(
      app.id,
      input.environmentSlug,
    );
    if (!environment) {
      return {
        status: 'error',
        message: `Environment "${input.environmentSlug}" not found in app "${app.slug}"`,
      };
    }
    const flag = await this.flagRepository.findByKey(app.id, input.flagKey);
    if (!flag) {
      return {
        status: 'error',
        message: `Flag "${input.flagKey}" not found in app "${app.slug}"`,
      };
    }

    // The transaction reads the previous value itself: the report cannot be stale.
    const { change } = await this.changeFlagValue.execute(
      flag,
      environment,
      input.enabled,
      { name: input.actor, identity: `cli:${input.actor}`, source: 'cli' },
    );
    if (!change) {
      return { status: 'unchanged' };
    }
    return { status: 'changed', previous: change.oldEnabled };
  }
}

import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigEntryRepository } from '../../domain/config-entry/config-entry.repository';
import { ConfigValueRepository } from '../../domain/config-entry/config-value.repository';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { FlagValueRepository } from '../../domain/feature-flag/flag-value.repository';
import { AuthenticateApiKeyUseCase } from '../api-key/authenticate-api-key.use-case';
import { FlagsAndConfigsDto } from './flags-and-configs.dto';

/**
 * Legacy read of every flag and config of the key's environment. The `environment` query
 * parameter is kept for compatibility but must name the key's own environment (400 otherwise).
 */
@Injectable()
export class GetFlagsAndConfigsUseCase {
  constructor(
    private readonly authenticateApiKey: AuthenticateApiKeyUseCase,
    private readonly featureFlagRepository: FeatureFlagRepository,
    private readonly flagValueRepository: FlagValueRepository,
    private readonly configEntryRepository: ConfigEntryRepository,
    private readonly configValueRepository: ConfigValueRepository,
  ) {}

  async execute(
    apiKeyToken: string,
    environmentSlug: string,
  ): Promise<FlagsAndConfigsDto> {
    const authenticated = await this.authenticateApiKey.execute(apiKeyToken);
    if (!authenticated) {
      throw new UnauthorizedException('Invalid API key');
    }
    const { apiKey, app, environment } = authenticated;

    if (environmentSlug !== environment.slug) {
      throw new BadRequestException(
        'This API key is bound to another environment',
      );
    }

    // A web key only sees client-exposed flags, and no flag is client-exposed yet; configs are
    // never exposed to browsers.
    if (apiKey.scope === 'web') {
      return {
        app: app.slug,
        environment: environment.slug,
        flags: {},
        configs: {},
      };
    }

    const [featureFlags, flagValues, configEntries, configValues] =
      await Promise.all([
        this.featureFlagRepository.findAllByAppId(app.id),
        this.flagValueRepository.findAllByAppId(app.id),
        this.configEntryRepository.findAllByAppId(app.id),
        this.configValueRepository.findAllByAppId(app.id),
      ]);

    const flags: Record<string, boolean> = {};
    for (const flag of featureFlags) {
      const value = flagValues.find(
        (v) => v.flagId === flag.id && v.environmentId === environment.id,
      );
      flags[flag.key] = value?.enabled ?? false;
    }

    const configs: Record<string, unknown> = {};
    for (const entry of configEntries) {
      const value = configValues.find(
        (v) =>
          v.configEntryId === entry.id && v.environmentId === environment.id,
      );
      configs[entry.key] = value ? value.parse() : null;
    }

    return {
      app: app.slug,
      environment: environment.slug,
      flags,
      configs,
    };
  }
}

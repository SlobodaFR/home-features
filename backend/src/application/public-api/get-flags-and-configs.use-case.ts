import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyRepository } from '../../domain/api-key/api-key.repository';
import { hashApiKeyToken } from '../../domain/api-key/api-key-token';
import { AppRepository } from '../../domain/app/app.repository';
import { ConfigEntryRepository } from '../../domain/config-entry/config-entry.repository';
import { ConfigValueRepository } from '../../domain/config-entry/config-value.repository';
import { EnvironmentRepository } from '../../domain/environment/environment.repository';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { FlagValueRepository } from '../../domain/feature-flag/flag-value.repository';
import { FlagsAndConfigsDto } from './flags-and-configs.dto';

@Injectable()
export class GetFlagsAndConfigsUseCase {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly appRepository: AppRepository,
    private readonly environmentRepository: EnvironmentRepository,
    private readonly featureFlagRepository: FeatureFlagRepository,
    private readonly flagValueRepository: FlagValueRepository,
    private readonly configEntryRepository: ConfigEntryRepository,
    private readonly configValueRepository: ConfigValueRepository,
  ) {}

  async execute(
    apiKeyToken: string,
    environmentSlug: string,
  ): Promise<FlagsAndConfigsDto> {
    const apiKey = await this.apiKeyRepository.findByKeyHash(
      hashApiKeyToken(apiKeyToken),
    );
    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const app = await this.appRepository.findById(apiKey.appId);
    if (!app) {
      throw new UnauthorizedException('Invalid API key');
    }

    const environment = await this.environmentRepository.findBySlug(
      app.id,
      environmentSlug,
    );
    if (!environment) {
      throw new NotFoundException(
        `Environment "${environmentSlug}" not found for this app`,
      );
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

    // Best-effort: update lastUsedAt without failing the request.
    try {
      await this.apiKeyRepository.save(apiKey.withLastUsedAt(new Date()));
    } catch {
      // ignore
    }

    return {
      app: app.slug,
      environment: environment.slug,
      flags,
      configs,
    };
  }
}

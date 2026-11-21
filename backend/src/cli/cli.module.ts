import { Module } from '@nestjs/common';
import { SetFlagFromCliUseCase } from '../application/feature-flag/set-flag-from-cli.use-case';
import { FeatureFlagModule } from '../interfaces/http/modules/feature-flag.module';

/** What the emergency CLI needs on top of FeatureFlagModule (configuration and database aside). */
@Module({
  imports: [FeatureFlagModule],
  providers: [SetFlagFromCliUseCase],
})
export class CliModule {}

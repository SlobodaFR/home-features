import { Module } from '@nestjs/common';
import { EvaluateOfrepFlagsUseCase } from '../../../application/ofrep/evaluate-ofrep-flags.use-case';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { OfrepController } from '../ofrep/ofrep.controller';
import { FeatureFlagModule } from './feature-flag.module';

/** OFREP evaluation; reuses FeatureFlagModule's repositories, key authentication and debouncer. */
@Module({
  imports: [FeatureFlagModule],
  controllers: [OfrepController],
  providers: [EvaluateOfrepFlagsUseCase, ApiKeyGuard],
})
export class OfrepModule {}

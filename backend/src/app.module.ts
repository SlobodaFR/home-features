import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'path';
import { validateEnv } from './infrastructure/config/validate-env';
import { FeatureFlagsModule } from './infrastructure/feature-flags/feature-flags.module';
import { loggerParams } from './infrastructure/logging/logger.config';
import { serveStaticOptions } from './static-assets';
import { DatabaseModule } from './infrastructure/persistence/database.module';
import { SameOriginGuard } from './interfaces/http/guards/same-origin.guard';
import { AuthModule } from './interfaces/http/modules/auth.module';
import { HealthModule } from './interfaces/http/modules/health.module';
import { FeatureFlagModule } from './interfaces/http/modules/feature-flag.module';
import { MeModule } from './interfaces/http/modules/me.module';
import { OfrepModule } from './interfaces/http/modules/ofrep.module';
import { throttlerOptions } from './interfaces/http/throttling';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        // validateEnv guarantees PSEUDONYM_SECRET (a development fallback outside production).
        loggerParams(
          config.get<string>('NODE_ENV'),
          config.getOrThrow<string>('PSEUDONYM_SECRET'),
        ),
    }),
    ThrottlerModule.forRoot(throttlerOptions),
    FeatureFlagsModule,
    DatabaseModule,
    ServeStaticModule.forRoot(serveStaticOptions(join(__dirname, 'public'))),
    AuthModule,
    MeModule,
    FeatureFlagModule,
    OfrepModule,
    HealthModule,
  ],
  providers: [
    // Rate limit first, before any session or JWKS work (@SkipThrottle opts out).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // CSRF: every cookie-authenticated mutation must come from this origin (@SkipSameOrigin opts out).
    { provide: APP_GUARD, useClass: SameOriginGuard },
  ],
})
export class AppModule {}

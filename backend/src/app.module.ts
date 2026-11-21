import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { validateEnv } from './infrastructure/config/validate-env';
import { serveStaticOptions } from './static-assets';
import { DatabaseModule } from './infrastructure/persistence/database.module';
import { SameOriginGuard } from './interfaces/http/guards/same-origin.guard';
import { AuthModule } from './interfaces/http/modules/auth.module';
import { FeatureFlagModule } from './interfaces/http/modules/feature-flag.module';
import { MeModule } from './interfaces/http/modules/me.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    ServeStaticModule.forRoot(serveStaticOptions(join(__dirname, 'public'))),
    AuthModule,
    MeModule,
    FeatureFlagModule,
  ],
  // CSRF: every cookie-authenticated mutation must come from this origin (@SkipSameOrigin opts out).
  providers: [{ provide: APP_GUARD, useClass: SameOriginGuard }],
})
export class AppModule {}

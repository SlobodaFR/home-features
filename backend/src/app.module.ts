import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { serveStaticOptions } from './static-assets';
import { DatabaseModule } from './infrastructure/persistence/database.module';
import { AuthModule } from './interfaces/http/modules/auth.module';
import { FeatureFlagModule } from './interfaces/http/modules/feature-flag.module';
import { MeModule } from './interfaces/http/modules/me.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ServeStaticModule.forRoot(serveStaticOptions(join(__dirname, 'public'))),
    AuthModule,
    MeModule,
    FeatureFlagModule,
  ],
})
export class AppModule {}

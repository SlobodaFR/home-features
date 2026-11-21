import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { validateEnv } from '../infrastructure/config/validate-env';
import { loggerParams } from '../infrastructure/logging/logger.config';
import { DatabaseModule } from '../infrastructure/persistence/database.module';
import { CliModule } from './cli.module';

/**
 * The CLI's application context: same environment validation, logger and database (migrations,
 * SchemaGuard) as the server, without HTTP.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        loggerParams(
          config.get<string>('NODE_ENV'),
          config.getOrThrow<string>('PSEUDONYM_SECRET'),
        ),
    }),
    DatabaseModule,
    CliModule,
  ],
})
export class CliAppModule {}

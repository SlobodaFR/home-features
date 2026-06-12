import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyOrmEntity } from './entities/api-key.orm-entity';
import { AppOrmEntity } from './entities/app.orm-entity';
import { ConfigEntryOrmEntity } from './entities/config-entry.orm-entity';
import { ConfigValueOrmEntity } from './entities/config-value.orm-entity';
import { EnvironmentOrmEntity } from './entities/environment.orm-entity';
import { FeatureFlagOrmEntity } from './entities/feature-flag.orm-entity';
import { FlagValueOrmEntity } from './entities/flag-value.orm-entity';
import { RevokedSessionOrmEntity } from './entities/revoked-session.orm-entity';
import { UserOrmEntity } from './entities/user.orm-entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3',
        database: config.get<string>('DATABASE_PATH', 'data/features.sqlite'),
        // WAL mode is required for Litestream replication.
        enableWAL: true,
        entities: [
          UserOrmEntity,
          RevokedSessionOrmEntity,
          AppOrmEntity,
          EnvironmentOrmEntity,
          FeatureFlagOrmEntity,
          FlagValueOrmEntity,
          ConfigEntryOrmEntity,
          ConfigValueOrmEntity,
          ApiKeyOrmEntity,
        ],
        synchronize: true,
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}

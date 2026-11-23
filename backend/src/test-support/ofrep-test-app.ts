import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { configureApp } from '../configure-app';
import {
  generateApiKeyToken,
  hashApiKeyToken,
} from '../domain/api-key/api-key-token';
import { AccessTokenVerifier } from '../domain/auth/access-token-verifier';
import { OAuthClient } from '../domain/auth/oauth-client';
import { RevokedSessionRepository } from '../domain/auth/revoked-session.repository';
import { Telemetry } from '../domain/shared/telemetry';
import { ENTITIES } from '../infrastructure/persistence/entities';
import { MIGRATIONS } from '../infrastructure/persistence/migrations';
import { JwtAuthGuard } from '../interfaces/http/guards/jwt-auth.guard';
import { SameOriginGuard } from '../interfaces/http/guards/same-origin.guard';
import { TelemetryInterceptor } from '../interfaces/http/telemetry.interceptor';
import { OfrepModule } from '../interfaces/http/modules/ofrep.module';
import { throttlerOptions } from '../interfaces/http/throttling';
import { FakeTelemetry } from './fake-telemetry';
import { testConfigModule } from './test-config.module';

/** Any session work would be a bug on /ofrep: these stubs fail loudly if called. */
function forbidden(call: string): never {
  throw new Error(`${call} must not be called by /ofrep`);
}

class ForbiddenAccessTokenVerifier extends AccessTokenVerifier {
  verify(): never {
    return forbidden('AccessTokenVerifier.verify');
  }
}

class ForbiddenOAuthClient extends OAuthClient {
  authorizeUrl(): never {
    return forbidden('OAuthClient.authorizeUrl');
  }
  exchangeCode(): never {
    return forbidden('OAuthClient.exchangeCode');
  }
  refresh(): never {
    return forbidden('OAuthClient.refresh');
  }
  fetchUserInfo(): never {
    return forbidden('OAuthClient.fetchUserInfo');
  }
}

class ForbiddenRevokedSessionRepository extends RevokedSessionRepository {
  markRevoked(): never {
    return forbidden('RevokedSessionRepository.markRevoked');
  }
  getRevokedAt(): never {
    return forbidden('RevokedSessionRepository.getRevokedAt');
  }
}

export interface OfrepFixture {
  app: NestExpressApplication;
  dataSource: DataSource;
  /** What the application's global TelemetryInterceptor reported. */
  telemetry: FakeTelemetry;
  keys: { server: string; web: string; staging: string };
  ids: { production: string; staging: string; serverKey: string };
  close(): Promise<void>;
}

/**
 * The OFREP module behind the application's three global guards (ThrottlerGuard, SameOriginGuard,
 * JwtAuthGuard) and configureApp, on an in-memory database migrated like production, seeded with:
 * production flags on-flag (on), off-flag (off), unset-flag (no value), exposed-flag
 * (client-exposed, on); a server and a web key for production, a server key for staging. The
 * global TelemetryInterceptor is on, with a recording Telemetry.
 */
export async function ofrepTestApp(): Promise<OfrepFixture> {
  const telemetry = new FakeTelemetry();
  const moduleRef = await Test.createTestingModule({
    imports: [
      testConfigModule(),
      TypeOrmModule.forRoot({
        type: 'better-sqlite3',
        database: ':memory:',
        entities: ENTITIES,
        migrations: MIGRATIONS,
        migrationsRun: true,
      }),
      ThrottlerModule.forRoot(throttlerOptions),
      OfrepModule,
    ],
    providers: [
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: APP_GUARD, useClass: SameOriginGuard },
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: Telemetry, useValue: telemetry },
      { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
      { provide: AccessTokenVerifier, useClass: ForbiddenAccessTokenVerifier },
      { provide: OAuthClient, useClass: ForbiddenOAuthClient },
      {
        provide: RevokedSessionRepository,
        useClass: ForbiddenRevokedSessionRepository,
      },
    ],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, { TRUST_PROXY_HOPS: '1' });
  await app.init();
  const dataSource = moduleRef.get(DataSource);

  const at = "'2026-11-01 10:00:00'";
  await dataSource.query(
    `INSERT INTO apps (id, user_id, name, slug, description, created_at) VALUES ('a1', 'u1', 'Budget', 'budget', NULL, ${at})`,
  );
  await dataSource.query(
    `INSERT INTO environments (id, app_id, name, slug, "order", created_at) VALUES ('e-prod', 'a1', 'Production', 'production', 0, ${at}), ('e-staging', 'a1', 'Staging', 'staging', 1, ${at})`,
  );
  await dataSource.query(
    `INSERT INTO feature_flags (id, app_id, key, name, description, created_at, client_exposed) VALUES ('f-on', 'a1', 'on-flag', 'On', NULL, ${at}, 0), ('f-off', 'a1', 'off-flag', 'Off', NULL, ${at}, 0), ('f-unset', 'a1', 'unset-flag', 'Unset', NULL, ${at}, 0), ('f-exposed', 'a1', 'exposed-flag', 'Exposed', NULL, ${at}, 1)`,
  );
  await dataSource.query(
    `INSERT INTO flag_values (id, flag_id, environment_id, enabled, updated_at) VALUES ('v1', 'f-on', 'e-prod', 1, ${at}), ('v2', 'f-off', 'e-prod', 0, ${at}), ('v3', 'f-exposed', 'e-prod', 1, ${at}), ('v4', 'f-on', 'e-staging', 0, ${at})`,
  );
  const insertKey = async (
    id: string,
    environmentId: string,
    scope: string,
  ): Promise<string> => {
    const token = generateApiKeyToken();
    await dataSource.query(
      `INSERT INTO api_keys (id, app_id, name, key_hash, created_at, environment_id, scope) VALUES (?, 'a1', ?, ?, ${at}, ?, ?)`,
      [id, id, hashApiKeyToken(token), environmentId, scope],
    );
    return token;
  };
  const keys = {
    server: await insertKey('k-server', 'e-prod', 'server'),
    web: await insertKey('k-web', 'e-prod', 'web'),
    staging: await insertKey('k-staging', 'e-staging', 'server'),
  };

  return {
    app,
    dataSource,
    telemetry,
    keys,
    ids: { production: 'e-prod', staging: 'e-staging', serverKey: 'k-server' },
    close: () => app.close(),
  };
}

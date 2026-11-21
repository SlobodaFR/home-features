import {
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Module,
  Post,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app.module';
import { SkipSameOrigin } from '../decorators/skip-same-origin.decorator';
import { AuthController } from '../controllers/auth.controller';
import { AuthModule } from '../modules/auth.module';
import { FeatureFlagModule } from '../modules/feature-flag.module';
import { MeModule } from '../modules/me.module';
import { PublicApiController } from '../controllers/public-api.controller';
import { SameOriginGuard } from './same-origin.guard';

function guard(
  env: Record<string, string> = { FRONTEND_URL: 'https://features.sloboda.fr' },
) {
  return new SameOriginGuard(new ConfigService(env), new Reflector());
}

function context(
  method: string,
  headers: Record<string, string>,
): ExecutionContext {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, headers: lower }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('SameOriginGuard', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'lets %s through whatever the headers',
    (method) => {
      expect(
        guard().canActivate(
          context(method, { 'Sec-Fetch-Site': 'cross-site' }),
        ),
      ).toBe(true);
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'accepts a same-origin %s',
    (method) => {
      expect(
        guard().canActivate(
          context(method, { 'Sec-Fetch-Site': 'same-origin' }),
        ),
      ).toBe(true);
    },
  );

  // same-site is exactly the attack: another *.sloboda.fr subdomain.
  it.each(['same-site', 'cross-site', 'none'])(
    'refuses Sec-Fetch-Site %s even with a trusted Origin',
    (site) => {
      expect(() =>
        guard().canActivate(
          context('POST', {
            'Sec-Fetch-Site': site,
            Origin: 'https://features.sloboda.fr',
          }),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it('falls back to a trusted Origin when Sec-Fetch-Site is absent', () => {
    expect(
      guard().canActivate(
        context('POST', { Origin: 'https://features.sloboda.fr' }),
      ),
    ).toBe(true);
  });

  it('refuses an untrusted Origin, or no Origin at all', () => {
    expect(() =>
      guard().canActivate(
        context('POST', { Origin: 'https://budget.sloboda.fr' }),
      ),
    ).toThrow(ForbiddenException);
    expect(() => guard().canActivate(context('POST', {}))).toThrow(
      ForbiddenException,
    );
  });

  it('defaults to the local service URL without configuration', () => {
    expect(
      guard({}).canActivate(
        context('POST', { Origin: 'http://localhost:3002' }),
      ),
    ).toBe(true);
  });

  it.each(['application/x-www-form-urlencoded', 'text/plain; charset=utf-8'])(
    'refuses %s bodies (form posts) even from the same origin',
    (contentType) => {
      expect(() =>
        guard().canActivate(
          context('POST', {
            'Sec-Fetch-Site': 'same-origin',
            'Content-Type': contentType,
          }),
        ),
      ).toThrow(UnsupportedMediaTypeException);
    },
  );

  it('accepts JSON and multipart bodies', () => {
    for (const contentType of [
      'application/json',
      'multipart/form-data; boundary=x',
    ]) {
      expect(
        guard().canActivate(
          context('POST', {
            'Sec-Fetch-Site': 'same-origin',
            'Content-Type': contentType,
          }),
        ),
      ).toBe(true);
    }
  });
});

@Controller('cookie')
class CookieController {
  @Post()
  mutate() {
    return { ok: true };
  }

  @Get()
  read() {
    return { ok: true };
  }
}

@SkipSameOrigin()
@Controller('server')
class ServerToServerController {
  @Post()
  hook() {
    return { ok: true };
  }
}

@Controller('mixed')
class MixedController {
  @SkipSameOrigin()
  @Post('hook')
  hook() {
    return { ok: true };
  }

  @Post('session')
  session() {
    return { ok: true };
  }
}

@Module({
  controllers: [CookieController, ServerToServerController, MixedController],
  providers: [{ provide: APP_GUARD, useClass: SameOriginGuard }],
})
class WiredModule {}

describe('SameOriginGuard as a global guard', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WiredModule] })
      .useMocker((token) => {
        if (token === ConfigService) {
          return new ConfigService({
            FRONTEND_URL: 'https://features.sloboda.fr',
          });
        }
        return undefined;
      })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const cross = { 'Sec-Fetch-Site': 'cross-site' };

  it('refuses a cross-site mutation on a cookie route', async () => {
    await request(app.getHttpServer()).post('/cookie').set(cross).expect(403);
  });

  it('accepts the same mutation from the same origin and lets reads through', async () => {
    await request(app.getHttpServer())
      .post('/cookie')
      .set('Sec-Fetch-Site', 'same-origin')
      .expect(201);
    await request(app.getHttpServer()).get('/cookie').set(cross).expect(200);
  });

  it('lets a @SkipSameOrigin() controller through', async () => {
    await request(app.getHttpServer()).post('/server').set(cross).expect(201);
  });

  it('exempts only the decorated handler of a controller', async () => {
    await request(app.getHttpServer())
      .post('/mixed/hook')
      .set(cross)
      .expect(201);
    await request(app.getHttpServer())
      .post('/mixed/session')
      .set(cross)
      .expect(403);
  });
});

describe('same-origin wiring of the real application', () => {
  it('registers SameOriginGuard as a global guard', () => {
    const providers = Reflect.getMetadata('providers', AppModule) as {
      provide?: unknown;
      useClass?: unknown;
    }[];

    expect(
      providers.some(
        (provider) =>
          provider.provide === APP_GUARD &&
          provider.useClass === SameOriginGuard,
      ),
    ).toBe(true);
  });

  // The two server-to-server entry points: no cookie, authenticated by a secret or an API key.
  it('exempts the home-auth logout webhook and the public API, nothing else in the auth controller', () => {
    const skipped = (target: object) =>
      Reflect.getMetadata('skipSameOrigin', target) as boolean | undefined;
    const handler = (name: string) =>
      (AuthController.prototype as unknown as Record<string, object>)[name];

    expect(skipped(handler('disconnect'))).toBe(true);
    expect(skipped(handler('logout'))).toBeUndefined();
    expect(skipped(handler('callback'))).toBeUndefined();
    expect(skipped(PublicApiController)).toBe(true);
  });

  // Adding @SkipSameOrigin() anywhere else would silently open a cookie route to CSRF.
  it('exempts exactly the webhook and the public API across every controller', () => {
    const controllers = [AuthModule, FeatureFlagModule, MeModule].flatMap(
      (module) =>
        Reflect.getMetadata('controllers', module) as (new () => object)[],
    );
    const exempt: string[] = [];
    for (const controller of controllers) {
      if (Reflect.getMetadata('skipSameOrigin', controller) === true) {
        exempt.push(controller.name);
      }
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        if (name === 'constructor') {
          continue;
        }
        const handler = (controller.prototype as Record<string, unknown>)[name];
        if (
          typeof handler === 'function' &&
          Reflect.getMetadata('skipSameOrigin', handler) === true
        ) {
          exempt.push(`${controller.name}.${name}`);
        }
      }
    }

    expect(exempt.toSorted()).toEqual([
      'AuthController.disconnect',
      'PublicApiController',
    ]);
  });
});

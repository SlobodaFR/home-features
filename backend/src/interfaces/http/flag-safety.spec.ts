import { BadRequestException, ConflictException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { configureApp } from '../../configure-app';
import { FeatureFlagRepository } from '../../domain/feature-flag/feature-flag.repository';
import { ENTITIES } from '../../infrastructure/persistence/entities';
import { MIGRATIONS } from '../../infrastructure/persistence/migrations';
import { AppApiKeysController } from './controllers/app-api-keys.controller';
import { AppEnvironmentsController } from './controllers/app-environments.controller';
import { AppFlagsController } from './controllers/app-flags.controller';
import { AppsController } from './controllers/apps.controller';
import { FlagsController } from './controllers/flags.controller';
import { DeleteFeatureFlagDto } from './dto/save-feature-flag.dto';
import { PublicApiController } from './controllers/public-api.controller';
import { FeatureFlagModule } from './modules/feature-flag.module';
import { testConfigModule } from '../../test-support/test-config.module';

const USER = { id: 'user-1', email: 'user@example.com', name: 'User One' };

describe('Feature flag rollout safety (integration)', () => {
  let appsController: AppsController;
  let appEnvironmentsController: AppEnvironmentsController;
  let appFlagsController: AppFlagsController;
  let flagsController: FlagsController;
  let appApiKeysController: AppApiKeysController;
  let publicApiController: PublicApiController;
  let flagRepository: FeatureFlagRepository;
  let counter = 0;

  beforeAll(async () => {
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
        FeatureFlagModule,
      ],
    }).compile();
    appsController = moduleRef.get(AppsController);
    appEnvironmentsController = moduleRef.get(AppEnvironmentsController);
    appFlagsController = moduleRef.get(AppFlagsController);
    flagsController = moduleRef.get(FlagsController);
    appApiKeysController = moduleRef.get(AppApiKeysController);
    publicApiController = moduleRef.get(PublicApiController);
    flagRepository = moduleRef.get(FeatureFlagRepository);
  });

  async function setup() {
    counter += 1;
    const app = await appsController.create(
      { name: `App ${counter}`, slug: `app-${counter}`, description: null },
      USER,
    );
    const production = await appEnvironmentsController.create(
      app.id,
      { name: 'Production', slug: 'production' },
      USER,
    );
    const flag = await appFlagsController.create(
      app.id,
      { key: 'new-checkout', name: 'New checkout', description: null },
      USER,
    );
    return { app, production, flag };
  }

  it('creates flags that are not client-exposed and never evaluated', async () => {
    const { flag } = await setup();

    expect(flag.clientExposed).toBe(false);
    expect(flag.lastEvaluatedAt).toBeNull();
  });

  it('refuses to rename a flag key', async () => {
    const { flag } = await setup();

    await expect(
      flagsController.update(flag.id, { key: 'renamed', name: 'X' }, USER),
    ).rejects.toThrow(BadRequestException);
    const updated = await flagsController.update(
      flag.id,
      { key: 'new-checkout', name: 'Checkout v2' },
      USER,
    );
    expect(updated.key).toBe('new-checkout');
    expect(updated.name).toBe('Checkout v2');
  });

  it('marks a flag client-exposed without touching the rest', async () => {
    const { flag } = await setup();

    const updated = await flagsController.update(
      flag.id,
      { clientExposed: true },
      USER,
    );

    expect(updated).toMatchObject({
      key: 'new-checkout',
      name: 'New checkout',
      clientExposed: true,
    });
  });

  it('refuses to delete a flag that is on somewhere without confirmation naming its key', async () => {
    const { app, production, flag } = await setup();
    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: true },
      USER,
    );

    await expect(flagsController.remove(flag.id, {}, USER)).rejects.toThrow(
      ConflictException,
    );
    await expect(
      flagsController.remove(flag.id, { confirm: 'other-flag' }, USER),
    ).rejects.toThrow(ConflictException);
    expect(await appFlagsController.list(app.id, USER)).toHaveLength(1);

    await flagsController.remove(flag.id, { confirm: 'new-checkout' }, USER);
    expect(await appFlagsController.list(app.id, USER)).toHaveLength(0);
  });

  it('deletes a flag that is off everywhere without confirmation', async () => {
    const { app, production, flag } = await setup();
    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: false },
      USER,
    );

    await flagsController.remove(flag.id, {}, USER);

    expect(await appFlagsController.list(app.id, USER)).toHaveLength(0);
  });

  it('gives a web key only the client-exposed flags on the legacy endpoint', async () => {
    const { app, production, flag } = await setup();
    const exposed = await appFlagsController.create(
      app.id,
      { key: 'banner', name: 'Banner', description: null, clientExposed: true },
      USER,
    );
    await flagsController.setValue(
      flag.id,
      production.id,
      { enabled: true },
      USER,
    );
    await flagsController.setValue(
      exposed.id,
      production.id,
      { enabled: true },
      USER,
    );
    const web = await appApiKeysController.create(
      app.id,
      { name: 'spa', environmentId: production.id, scope: 'web' },
      USER,
    );

    const result = await publicApiController.flagsAndConfigs(
      `Bearer ${web.key}`,
      { environment: 'production' },
    );

    expect(result.flags).toEqual({ banner: true });
    expect(result.configs).toEqual({});
  });

  it('records the last evaluation of the flags served, at most once per ten minutes', async () => {
    const { app, production, flag } = await setup();
    const server = await appApiKeysController.create(
      app.id,
      { name: 'srv', environmentId: production.id, scope: 'server' },
      USER,
    );
    const touch = vi.spyOn(flagRepository, 'touchLastEvaluatedAt');

    await publicApiController.flagsAndConfigs(`Bearer ${server.key}`, {
      environment: 'production',
    });
    await publicApiController.flagsAndConfigs(`Bearer ${server.key}`, {
      environment: 'production',
    });

    const [listed] = await appFlagsController.list(app.id, USER);
    expect(listed.id).toBe(flag.id);
    expect(listed.lastEvaluatedAt).not.toBeNull();
    expect(touch).toHaveBeenCalledTimes(1);
    expect(touch).toHaveBeenCalledWith([flag.id], expect.any(Date));
    touch.mockRestore();
  });
});

describe('DELETE /api/flags/:id over HTTP', () => {
  // A union type (`Dto | undefined`) would be emitted as Object and skip validation entirely.
  it('validates the body with DeleteFeatureFlagDto', () => {
    const types = Reflect.getMetadata(
      'design:paramtypes',
      FlagsController.prototype,
      'remove',
    ) as unknown[];

    expect(types[1]).toBe(DeleteFeatureFlagDto);
  });

  let app: NestExpressApplication;
  let appsController: AppsController;
  let appEnvironmentsController: AppEnvironmentsController;
  let appFlagsController: AppFlagsController;
  let flagsController: FlagsController;

  beforeAll(async () => {
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
        FeatureFlagModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    // Stands in for JwtAuthGuard: the session is not what this test is about.
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = USER;
      next();
    });
    configureApp(app, {});
    await app.init();
    appsController = moduleRef.get(AppsController);
    appEnvironmentsController = moduleRef.get(AppEnvironmentsController);
    appFlagsController = moduleRef.get(AppFlagsController);
    flagsController = moduleRef.get(FlagsController);
  });

  afterAll(async () => {
    await app.close();
  });

  it('needs no body for a flag that is off, and a JSON confirm for one that is on', async () => {
    const created = await appsController.create(
      { name: 'Http', slug: 'http', description: null },
      USER,
    );
    const env = await appEnvironmentsController.create(
      created.id,
      { name: 'Production', slug: 'production' },
      USER,
    );
    const off = await appFlagsController.create(
      created.id,
      { key: 'off-flag', name: 'Off', description: null },
      USER,
    );
    const on = await appFlagsController.create(
      created.id,
      { key: 'on-flag', name: 'On', description: null },
      USER,
    );
    await flagsController.setValue(on.id, env.id, { enabled: true }, USER);
    const server = app.getHttpServer();

    await request(server).delete(`/api/flags/${off.id}`).expect(204);
    const refused = await request(server)
      .delete(`/api/flags/${on.id}`)
      .expect(409);
    expect((refused.body as { message: string }).message).toContain(
      '{"confirm": "on-flag"}',
    );
    await request(server)
      .delete(`/api/flags/${on.id}`)
      .send({ confirm: 42 })
      .expect(400);
    await request(server)
      .delete(`/api/flags/${on.id}`)
      .send({ confirm: 'on-flag' })
      .expect(204);
  });
});

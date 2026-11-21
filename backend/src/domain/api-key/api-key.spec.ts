import { ApiKey, ApiKeyProps } from './api-key';

const props: ApiKeyProps = {
  id: 'key-1',
  appId: 'app-1',
  environmentId: 'env-1',
  scope: 'server',
  name: 'Backend',
  keyHash: 'a'.repeat(64),
  createdAt: new Date('2026-11-01T10:00:00Z'),
  lastUsedAt: null,
};

describe('ApiKey', () => {
  it('is bound to an app, an environment and a scope', () => {
    const key = ApiKey.create(props);

    expect(key.appId).toBe('app-1');
    expect(key.environmentId).toBe('env-1');
    expect(key.scope).toBe('server');
  });

  it('accepts the web scope', () => {
    expect(ApiKey.create({ ...props, scope: 'web' }).scope).toBe('web');
  });

  it.each([null, undefined, '', '  '])(
    'refuses a key without environment (%s)',
    (environmentId) => {
      expect(() =>
        ApiKey.create({
          ...props,
          environmentId: environmentId as unknown as string,
        }),
      ).toThrow('API key must be bound to an environment');
    },
  );

  it.each(['admin', '', 'SERVER'])('refuses the scope %j', (scope) => {
    expect(() =>
      ApiKey.create({ ...props, scope: scope as unknown as 'server' }),
    ).toThrow('API key scope must be "server" or "web"');
  });

  it('refuses an empty name', () => {
    expect(() => ApiKey.create({ ...props, name: ' ' })).toThrow(
      'API key name must not be empty',
    );
  });
});

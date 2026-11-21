import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveApiKeyDto } from './save-api-key.dto';

async function errorsOf(body: object): Promise<string[]> {
  const errors = await validate(plainToInstance(SaveApiKeyDto, body));
  return errors.map((error) => error.property).toSorted();
}

describe('SaveApiKeyDto', () => {
  it('accepts a name, an environment and a scope', async () => {
    expect(
      await errorsOf({ name: 'Backend', environmentId: 'e1', scope: 'server' }),
    ).toEqual([]);
    expect(
      await errorsOf({ name: 'SPA', environmentId: 'e1', scope: 'web' }),
    ).toEqual([]);
  });

  it('requires the environment and the scope', async () => {
    expect(await errorsOf({ name: 'Backend' })).toEqual([
      'environmentId',
      'scope',
    ]);
  });

  it('refuses an unknown scope', async () => {
    expect(
      await errorsOf({ name: 'Backend', environmentId: 'e1', scope: 'admin' }),
    ).toEqual(['scope']);
  });
});

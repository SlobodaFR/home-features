import { sanitizeTelemetryProperties } from './telemetry';

describe('sanitizeTelemetryProperties', () => {
  it('keeps numbers, booleans and plain strings', () => {
    expect(
      sanitizeTelemetryProperties({
        route: '/api/apps/:appId',
        method: 'GET',
        status: 200,
        ok: true,
      }),
    ).toEqual({
      route: '/api/apps/:appId',
      method: 'GET',
      status: 200,
      ok: true,
    });
  });

  it('drops forbidden keys, whatever their value', () => {
    expect(
      sanitizeTelemetryProperties({
        email: 'x',
        IP: 'x',
        token: 'x',
        authorization: 'x',
        cookie: 'x',
        route: '/ok',
      }),
    ).toEqual({ route: '/ok' });
  });

  it.each([
    ['an email', 'alice@example.com'],
    ['an IPv4 address', '203.0.113.7'],
    ['an IPv6 address', '2001:db8::1'],
    ['a UUID', '3f2b8c1e-5a4d-4e8f-9b7a-1c2d3e4f5a6b'],
    ['a feature-flag API key', `hf_${'a1'.repeat(32)}`],
    ['a JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln'],
  ])('drops a value that looks like %s', (_label, value) => {
    expect(sanitizeTelemetryProperties({ route: value, status: 200 })).toEqual({
      status: 200,
    });
  });

  it('drops objects, arrays and null: they could nest anything', () => {
    expect(
      sanitizeTelemetryProperties({ a: { b: 1 }, c: [1], d: null, e: 1 }),
    ).toEqual({ e: 1 });
  });
});

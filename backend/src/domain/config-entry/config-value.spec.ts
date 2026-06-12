import { ConfigValue } from './config-value';
import { ConfigValueType } from './config-value-type.enum';

function makeProps(value: string, type: ConfigValueType) {
  return {
    id: 'cv-1',
    configEntryId: 'ce-1',
    environmentId: 'env-1',
    value,
    type,
    updatedAt: new Date('2026-01-01'),
  };
}

describe('ConfigValue', () => {
  describe('STRING', () => {
    it('accepts any text', () => {
      expect(() =>
        ConfigValue.create(makeProps('hello world', ConfigValueType.STRING)),
      ).not.toThrow();
    });

    it('accepts an empty string', () => {
      expect(() =>
        ConfigValue.create(makeProps('', ConfigValueType.STRING)),
      ).not.toThrow();
    });

    it('parses to the raw string', () => {
      const cv = ConfigValue.create(makeProps('hello', ConfigValueType.STRING));
      expect(cv.parse()).toBe('hello');
    });
  });

  describe('NUMBER', () => {
    it('accepts an integer string', () => {
      const cv = ConfigValue.create(makeProps('42', ConfigValueType.NUMBER));
      expect(cv.parse()).toBe(42);
    });

    it('accepts a negative decimal', () => {
      const cv = ConfigValue.create(makeProps('-3.14', ConfigValueType.NUMBER));
      expect(cv.parse()).toBe(-3.14);
    });

    it('accepts a leading-zero decimal', () => {
      const cv = ConfigValue.create(makeProps('0.5', ConfigValueType.NUMBER));
      expect(cv.parse()).toBe(0.5);
    });

    it('rejects a non-numeric string', () => {
      expect(() =>
        ConfigValue.create(makeProps('not-a-number', ConfigValueType.NUMBER)),
      ).toThrow();
    });

    it('rejects an empty string', () => {
      expect(() =>
        ConfigValue.create(makeProps('', ConfigValueType.NUMBER)),
      ).toThrow();
    });

    it('rejects a whitespace-only string', () => {
      expect(() =>
        ConfigValue.create(makeProps('   ', ConfigValueType.NUMBER)),
      ).toThrow();
    });

    it('rejects Infinity/NaN-producing strings', () => {
      expect(() =>
        ConfigValue.create(makeProps('Infinity', ConfigValueType.NUMBER)),
      ).toThrow();
      expect(() =>
        ConfigValue.create(makeProps('NaN', ConfigValueType.NUMBER)),
      ).toThrow();
    });
  });

  describe('BOOLEAN', () => {
    it('accepts "true"', () => {
      const cv = ConfigValue.create(makeProps('true', ConfigValueType.BOOLEAN));
      expect(cv.parse()).toBe(true);
    });

    it('accepts "false"', () => {
      const cv = ConfigValue.create(
        makeProps('false', ConfigValueType.BOOLEAN),
      );
      expect(cv.parse()).toBe(false);
    });

    it('rejects "True" (case sensitive)', () => {
      expect(() =>
        ConfigValue.create(makeProps('True', ConfigValueType.BOOLEAN)),
      ).toThrow();
    });

    it('rejects "1"/"0"', () => {
      expect(() =>
        ConfigValue.create(makeProps('1', ConfigValueType.BOOLEAN)),
      ).toThrow();
      expect(() =>
        ConfigValue.create(makeProps('0', ConfigValueType.BOOLEAN)),
      ).toThrow();
    });

    it('rejects an empty string', () => {
      expect(() =>
        ConfigValue.create(makeProps('', ConfigValueType.BOOLEAN)),
      ).toThrow();
    });
  });

  describe('JSON', () => {
    it('accepts a JSON object', () => {
      const cv = ConfigValue.create(
        makeProps('{"a":1,"b":[2,3]}', ConfigValueType.JSON),
      );
      expect(cv.parse()).toEqual({ a: 1, b: [2, 3] });
    });

    it('accepts a JSON array', () => {
      const cv = ConfigValue.create(makeProps('[1,2,3]', ConfigValueType.JSON));
      expect(cv.parse()).toEqual([1, 2, 3]);
    });

    it('accepts a JSON primitive', () => {
      const cv = ConfigValue.create(makeProps('42', ConfigValueType.JSON));
      expect(cv.parse()).toBe(42);

      const cvBool = ConfigValue.create(
        makeProps('true', ConfigValueType.JSON),
      );
      expect(cvBool.parse()).toBe(true);

      const cvStr = ConfigValue.create(
        makeProps('"hello"', ConfigValueType.JSON),
      );
      expect(cvStr.parse()).toBe('hello');
    });

    it('rejects invalid JSON', () => {
      expect(() =>
        ConfigValue.create(makeProps('{invalid}', ConfigValueType.JSON)),
      ).toThrow();
      expect(() =>
        ConfigValue.create(makeProps('{"a":1,}', ConfigValueType.JSON)),
      ).toThrow();
    });

    it('rejects an empty string', () => {
      expect(() =>
        ConfigValue.create(makeProps('', ConfigValueType.JSON)),
      ).toThrow();
    });
  });

  describe('validate (static helper)', () => {
    it('does not throw for valid values', () => {
      expect(() =>
        ConfigValue.validate('42', ConfigValueType.NUMBER),
      ).not.toThrow();
    });

    it('throws for invalid values', () => {
      expect(() =>
        ConfigValue.validate('nope', ConfigValueType.NUMBER),
      ).toThrow();
    });
  });
});

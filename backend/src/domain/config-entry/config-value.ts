import { ConfigValueType } from './config-value-type.enum';

export interface ConfigValueProps {
  id: string;
  configEntryId: string;
  environmentId: string;
  /** Raw textual representation, validated against `type` at construction. */
  value: string;
  type: ConfigValueType;
  updatedAt: Date;
}

/**
 * ConfigValue holds the textual representation of a ConfigEntry's value in
 * a given Environment. The raw `value` is validated against the
 * ConfigEntry's `type`:
 *
 * - STRING: any text is valid.
 * - NUMBER: must be a finite numeric string (e.g. "42", "3.14", "-1").
 * - BOOLEAN: must be exactly "true" or "false".
 * - JSON: must be a valid, parseable JSON document.
 */
export class ConfigValue {
  private constructor(private readonly props: ConfigValueProps) {
    ConfigValue.validate(props.value, props.type);
  }

  static create(props: ConfigValueProps): ConfigValue {
    return new ConfigValue(props);
  }

  /**
   * Validates a raw string value against a ConfigValueType. Throws an Error
   * with a human-readable message if invalid.
   */
  static validate(value: string, type: ConfigValueType): void {
    switch (type) {
      case ConfigValueType.STRING:
        return;
      case ConfigValueType.NUMBER:
        if (value.trim() === '' || !Number.isFinite(Number(value))) {
          throw new Error(`Invalid NUMBER config value: "${value}"`);
        }
        return;
      case ConfigValueType.BOOLEAN:
        if (value !== 'true' && value !== 'false') {
          throw new Error(
            `Invalid BOOLEAN config value: "${value}" (must be "true" or "false")`,
          );
        }
        return;
      case ConfigValueType.JSON:
        try {
          JSON.parse(value);
        } catch {
          throw new Error(`Invalid JSON config value: "${value}"`);
        }
        return;
      default:
        throw new Error(`Unknown config value type "${type as string}"`);
    }
  }

  get id(): string {
    return this.props.id;
  }

  get configEntryId(): string {
    return this.props.configEntryId;
  }

  get environmentId(): string {
    return this.props.environmentId;
  }

  get value(): string {
    return this.props.value;
  }

  get type(): ConfigValueType {
    return this.props.type;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Parses the raw value into its native JS representation. */
  parse(): unknown {
    switch (this.props.type) {
      case ConfigValueType.STRING:
        return this.props.value;
      case ConfigValueType.NUMBER:
        return Number(this.props.value);
      case ConfigValueType.BOOLEAN:
        return this.props.value === 'true';
      case ConfigValueType.JSON:
        return JSON.parse(this.props.value);
    }
  }
}

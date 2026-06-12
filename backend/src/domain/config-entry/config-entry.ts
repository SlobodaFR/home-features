import { Slug } from '../shared/slug';
import { ConfigValueType } from './config-value-type.enum';

export interface ConfigEntryProps {
  id: string;
  appId: string;
  key: string;
  name: string;
  description: string | null;
  type: ConfigValueType;
  createdAt: Date;
}

/**
 * ConfigEntry describes a configuration key within an App (e.g.
 * "max-upload-size-mb" of type NUMBER). Its value per environment is
 * represented by ConfigValue, validated/parsed according to `type`.
 */
export class ConfigEntry {
  private constructor(private readonly props: ConfigEntryProps) {
    if (!props.name.trim()) {
      throw new Error('Config entry name must not be empty');
    }
    if (!Object.values(ConfigValueType).includes(props.type)) {
      throw new Error(`Invalid config entry type "${props.type}"`);
    }
    // Validates the key format; throws if invalid.
    Slug.create(props.key);
  }

  static create(props: ConfigEntryProps): ConfigEntry {
    return new ConfigEntry(props);
  }

  get id(): string {
    return this.props.id;
  }

  get appId(): string {
    return this.props.appId;
  }

  get key(): string {
    return this.props.key;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get type(): ConfigValueType {
    return this.props.type;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}

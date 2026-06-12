import { ConfigValueType } from '../../domain/config-entry/config-value-type.enum';

export interface ConfigEntryInput {
  key: string;
  name: string;
  description: string | null;
  type: ConfigValueType;
}

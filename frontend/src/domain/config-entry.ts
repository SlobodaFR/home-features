export enum ConfigValueType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  JSON = 'JSON',
}

export interface ConfigValue {
  environmentId: string;
  value: string;
  updatedAt: string;
}

export interface ConfigEntry {
  id: string;
  appId: string;
  key: string;
  name: string;
  description: string | null;
  type: ConfigValueType;
  createdAt: string;
}

export interface ConfigEntryWithValues extends ConfigEntry {
  values: ConfigValue[];
}

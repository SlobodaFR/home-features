import { ConfigValueType } from '../../domain/config-entry/config-value-type.enum';

export interface ConfigValueDto {
  environmentId: string;
  value: string;
  updatedAt: string;
}

export interface ConfigEntryDto {
  id: string;
  appId: string;
  key: string;
  name: string;
  description: string | null;
  type: ConfigValueType;
  createdAt: string;
}

export interface ConfigEntryWithValuesDto extends ConfigEntryDto {
  values: ConfigValueDto[];
}

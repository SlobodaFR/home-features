import { ConfigEntry } from '../../domain/config-entry/config-entry';
import { ConfigValue } from '../../domain/config-entry/config-value';
import {
  ConfigEntryDto,
  ConfigEntryWithValuesDto,
  ConfigValueDto,
} from './config-entry.dto';

export function toConfigEntryDto(configEntry: ConfigEntry): ConfigEntryDto {
  return {
    id: configEntry.id,
    appId: configEntry.appId,
    key: configEntry.key,
    name: configEntry.name,
    description: configEntry.description,
    type: configEntry.type,
    createdAt: configEntry.createdAt.toISOString(),
  };
}

export function toConfigValueDto(value: ConfigValue): ConfigValueDto {
  return {
    environmentId: value.environmentId,
    value: value.value,
    updatedAt: value.updatedAt.toISOString(),
  };
}

export function toConfigEntryWithValuesDto(
  configEntry: ConfigEntry,
  values: ConfigValue[],
): ConfigEntryWithValuesDto {
  return {
    ...toConfigEntryDto(configEntry),
    values: values.map(toConfigValueDto),
  };
}

import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ConfigValueType } from '../../../domain/config-entry/config-value-type.enum';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class SaveConfigEntryDto {
  @IsString()
  @Matches(SLUG_PATTERN, {
    message:
      'key must be lowercase alphanumeric with single hyphens (e.g. "max-upload-size-mb")',
  })
  key!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsEnum(ConfigValueType)
  type!: ConfigValueType;
}

import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { API_KEY_SCOPES } from '../../../domain/api-key/api-key';
import type { ApiKeyScope } from '../../../domain/api-key/api-key';

export class SaveApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  environmentId!: string;

  @IsIn(API_KEY_SCOPES)
  scope!: ApiKeyScope;
}

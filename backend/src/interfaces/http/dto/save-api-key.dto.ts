import { IsNotEmpty, IsString } from 'class-validator';

export class SaveApiKeyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

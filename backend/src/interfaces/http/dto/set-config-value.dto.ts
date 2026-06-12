import { IsString } from 'class-validator';

export class SetConfigValueDto {
  @IsString()
  value!: string;
}

import { IsBoolean } from 'class-validator';

export class SetFlagValueDto {
  @IsBoolean()
  enabled!: boolean;
}

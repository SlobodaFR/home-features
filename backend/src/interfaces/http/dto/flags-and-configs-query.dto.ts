import { IsNotEmpty, IsString } from 'class-validator';

export class FlagsAndConfigsQueryDto {
  @IsString()
  @IsNotEmpty()
  environment!: string;
}

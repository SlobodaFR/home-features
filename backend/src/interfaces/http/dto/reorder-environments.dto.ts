import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderEnvironmentsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  environmentIds!: string[];
}

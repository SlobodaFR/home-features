import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class SaveAppDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(SLUG_PATTERN, {
    message:
      'slug must be lowercase alphanumeric with single hyphens (e.g. "my-app")',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}

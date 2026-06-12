import { IsNotEmpty, IsString, Matches } from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class SaveEnvironmentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(SLUG_PATTERN, {
    message:
      'slug must be lowercase alphanumeric with single hyphens (e.g. "production")',
  })
  slug!: string;
}

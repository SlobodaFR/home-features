import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class SaveFeatureFlagDto {
  @IsString()
  @Matches(SLUG_PATTERN, {
    message:
      'key must be lowercase alphanumeric with single hyphens (e.g. "new-checkout-flow")',
  })
  key!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}

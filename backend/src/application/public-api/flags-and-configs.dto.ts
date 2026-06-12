export interface FlagsAndConfigsDto {
  app: string;
  environment: string;
  flags: Record<string, boolean>;
  configs: Record<string, unknown>;
}

import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '../infrastructure/config/validate-env';

/**
 * The global ConfigService as the app has it (values through validateEnv), without reading any
 * .env file nor falling back to process.env.
 */
export function testConfigModule(env: Record<string, string> = {}) {
  return ConfigModule.forRoot({
    isGlobal: true,
    ignoreEnvFile: true,
    validatePredefined: false,
    skipProcessEnv: true,
    validate: () => validateEnv({ NODE_ENV: 'test', ...env }),
  });
}

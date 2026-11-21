import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { CliAppModule } from './cli-app.module';
import { runSetFlag, SET_FLAG_FAILED } from './run-set-flag';

/**
 * Emergency flag switch, without UI nor home-auth:
 *   docker compose exec features node dist/cli/set-flag.js --app <slug> --env <slug> \
 *     --flag <key> --enabled true|false [--actor <name>]
 * Exit codes: see runSetFlag; 3 when the tool itself failed (database, configuration).
 */
async function main(): Promise<void> {
  // Bootstrap chatter off. abortOnError: false makes Nest rethrow a bootstrap failure (bad
  // DATABASE_PATH, SchemaGuard, migration) to main().catch instead of exiting 1 silently.
  const context = await NestFactory.createApplicationContext(CliAppModule, {
    logger: false,
    abortOnError: false,
  });
  // Structured JSON logs from here on, the flag_value_changed audit line included.
  context.useLogger(context.get(Logger));
  try {
    process.exitCode = await runSetFlag(
      process.argv.slice(2),
      context,
      (line) => process.stdout.write(`${line}\n`),
      (line) => process.stderr.write(`${line}\n`),
    );
  } finally {
    await context.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `set-flag failed: ${error instanceof Error ? error.message : 'unknown error'}\n`,
  );
  process.exitCode = SET_FLAG_FAILED;
});

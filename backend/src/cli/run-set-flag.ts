import type { INestApplicationContext } from '@nestjs/common';
import { SetFlagFromCliUseCase } from '../application/feature-flag/set-flag-from-cli.use-case';
import { parseSetFlagArgs } from './set-flag-args';

const state = (enabled: boolean | null) =>
  enabled === null ? 'unset' : enabled ? 'on' : 'off';

/** The tool failed (configuration, database locked or unreachable, schema drift). */
export const SET_FLAG_FAILED = 3;

/**
 * Exit codes: 0 done (or already set), 1 refused (unknown or ambiguous target), 2 usage,
 * 3 failure ({@link SET_FLAG_FAILED}, reported through `printError`: stderr in the CLI).
 */
export async function runSetFlag(
  argv: string[],
  context: INestApplicationContext,
  print: (line: string) => void,
  printError: (line: string) => void = print,
): Promise<number> {
  const parsed = parseSetFlagArgs(argv);
  if (!parsed.ok) {
    print(parsed.error);
    return 2;
  }
  const { app, env, flag, enabled, actor } = parsed.args;
  let result: Awaited<ReturnType<SetFlagFromCliUseCase['execute']>>;
  try {
    result = await context.get(SetFlagFromCliUseCase).execute({
      appSlug: app,
      environmentSlug: env,
      flagKey: flag,
      enabled,
      actor,
    });
  } catch (error) {
    printError(
      `set-flag failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    return SET_FLAG_FAILED;
  }
  const target = `${app}/${env} ${flag}`;
  switch (result.status) {
    case 'error':
      print(result.message);
      return 1;
    case 'unchanged':
      print(`${target}: already ${state(enabled)}, nothing written`);
      return 0;
    case 'changed':
      print(
        `${target}: ${state(result.previous)} -> ${state(enabled)} (journaled, source cli, actor ${actor})`,
      );
      return 0;
  }
}

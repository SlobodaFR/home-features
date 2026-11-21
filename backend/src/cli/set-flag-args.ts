import { parseArgs } from 'util';

export const SET_FLAG_USAGE =
  'Usage: node dist/cli/set-flag.js --app <slug> --env <slug> --flag <key> --enabled true|false [--actor <name>]';

export interface SetFlagArgs {
  app: string;
  env: string;
  flag: string;
  enabled: boolean;
  actor: string;
}

export type ParsedSetFlagArgs =
  | { ok: true; args: SetFlagArgs }
  | { ok: false; error: string };

export function parseSetFlagArgs(argv: string[]): ParsedSetFlagArgs {
  let values: Record<string, string | undefined>;
  try {
    ({ values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: {
        app: { type: 'string' },
        env: { type: 'string' },
        flag: { type: 'string' },
        enabled: { type: 'string' },
        actor: { type: 'string', default: 'cli' },
      },
    }));
  } catch (error) {
    return usage(error instanceof Error ? error.message : 'invalid arguments');
  }
  const app = values.app?.trim();
  const env = values.env?.trim();
  const flag = values.flag?.trim();
  const { enabled, actor } = values;
  if (!app || !env || !flag) {
    return usage('--app, --env and --flag are required');
  }
  if (enabled !== 'true' && enabled !== 'false') {
    return usage('--enabled must be true or false');
  }
  if (!actor?.trim()) {
    return usage('--actor must not be empty');
  }
  return {
    ok: true,
    args: { app, env, flag, enabled: enabled === 'true', actor: actor.trim() },
  };
}

function usage(reason: string): ParsedSetFlagArgs {
  return { ok: false, error: `${reason}\n${SET_FLAG_USAGE}` };
}

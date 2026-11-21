# Emergency CLI: `set-flag`

Switches one flag in one environment without the UI and without home-auth (for instance when
home-auth is down, or when a flag must be turned off right now). It runs inside the container,
on the same database, through the same code path as the UI: the value and its
`flag_value_changes` journal entry are written in one transaction (`source: "cli"`), and the
structured `flag_value_changed` log line is emitted with the actor pseudonymized.

## Usage (on the VPS)

```bash
cd <home-features deploy directory>   # where deploy/docker-compose.yml was copied
docker compose exec features node dist/cli/set-flag.js \
  --app <app slug> --env <environment slug> --flag <flag key> \
  --enabled true|false [--actor <your name>]
```

- `--actor` (default `cli`) is stored in the journal and shown in the UI history; the log line only
  carries its pseudonym.
- The container's environment is used as is (same validation as the server, same
  `DATABASE_PATH`); `docker compose exec` skips the entrypoint, so no second Litestream starts.
- Running it while the server runs is fine: SQLite in WAL mode, the write takes the write lock up
  front (`BEGIN IMMEDIATE`) and waits up to 5 s for a concurrent writer, and the server reads
  values from the database on every evaluation (no cache to invalidate). If it still reports
  `database is locked` (exit 3), run it again; if that keeps happening, something holds a
  write transaction for more than 5 s (not normal for this service): investigate before retrying.
- stdout carries the human result line and the JSON log lines (the `flag_value_changed` audit
  line among them); errors of the tool itself go to stderr.

Output and exit codes:

| Exit | Meaning                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`  | Changed (`budget/production new-ui: on -> off (journaled, ...)`) or already at that value (nothing written).                               |
| `1`  | Refused: unknown app, environment or flag, or **ambiguous app slug** (app slugs are unique per owner only; the message lists the app ids). |
| `2`  | Bad arguments (the usage is printed).                                                                                                      |
| `3`  | The tool failed: configuration, database unreachable or locked, schema drift (`set-flag failed: <reason>` on stderr).                      |

No permission check: whoever can `docker compose exec` into the container already has the
database. Locally, after `npm run build`: `npm run cli:set-flag -w backend -- --app ... --env ...`.

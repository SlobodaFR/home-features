export const FLAG_VALUE_CHANGE_SOURCES = ['ui', 'cli'] as const;
export type FlagValueChangeSource = (typeof FLAG_VALUE_CHANGE_SOURCES)[number];

export interface FlagValueChangeProps {
  id: string;
  flagId: string;
  environmentId: string;
  /** null: the flag had no value in this environment. */
  oldEnabled: boolean | null;
  newEnabled: boolean;
  /** Who changed it: the user's display name (UI) or the --actor given to the CLI. */
  actor: string;
  source: FlagValueChangeSource;
  at: Date;
}

/**
 * One entry of the append-only journal of flag value changes, written in the same transaction
 * as the value itself.
 */
export class FlagValueChange {
  private constructor(private readonly props: FlagValueChangeProps) {
    if (
      !(FLAG_VALUE_CHANGE_SOURCES as readonly string[]).includes(props.source)
    ) {
      throw new Error('Flag value change source must be "ui" or "cli"');
    }
    if (!props.actor.trim()) {
      throw new Error('Flag value change actor must not be empty');
    }
  }

  static create(props: FlagValueChangeProps): FlagValueChange {
    return new FlagValueChange(props);
  }

  get id(): string {
    return this.props.id;
  }

  get flagId(): string {
    return this.props.flagId;
  }

  get environmentId(): string {
    return this.props.environmentId;
  }

  get oldEnabled(): boolean | null {
    return this.props.oldEnabled;
  }

  get newEnabled(): boolean {
    return this.props.newEnabled;
  }

  get actor(): string {
    return this.props.actor;
  }

  get source(): FlagValueChangeSource {
    return this.props.source;
  }

  get at(): Date {
    return this.props.at;
  }
}

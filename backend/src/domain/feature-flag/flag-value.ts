export interface FlagValueProps {
  id: string;
  flagId: string;
  environmentId: string;
  enabled: boolean;
  updatedAt: Date;
}

/**
 * FlagValue represents the on/off state of a FeatureFlag in a given
 * Environment. There is at most one FlagValue per (flagId, environmentId)
 * pair.
 */
export class FlagValue {
  private constructor(private readonly props: FlagValueProps) {}

  static create(props: FlagValueProps): FlagValue {
    return new FlagValue(props);
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

  get enabled(): boolean {
    return this.props.enabled;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

import { Slug } from '../shared/slug';
import { FlagValue } from './flag-value';

export interface FeatureFlagProps {
  id: string;
  appId: string;
  /** Immutable: consumers reference it in code, a rename would silently fall back to defaults. */
  key: string;
  name: string;
  description: string | null;
  /** Visible to `web` API keys (browser-facing). False by default: flags are server-only. */
  clientExposed: boolean;
  /** Last time a consumer read this flag (debounced, at most every ten minutes). */
  lastEvaluatedAt: Date | null;
  createdAt: Date;
}

export interface FeatureFlagDetails {
  name?: string;
  description?: string | null;
  clientExposed?: boolean;
}

/**
 * FeatureFlag is identified within its App by a slug-like `key`
 * (e.g. "new-checkout-flow"), fixed at creation. Its on/off state per
 * environment is represented by FlagValue.
 */
export class FeatureFlag {
  private constructor(private readonly props: FeatureFlagProps) {
    if (!props.name.trim()) {
      throw new Error('Feature flag name must not be empty');
    }
    // Validates the key format; throws if invalid.
    Slug.create(props.key);
  }

  static create(props: FeatureFlagProps): FeatureFlag {
    return new FeatureFlag(props);
  }

  get id(): string {
    return this.props.id;
  }

  get appId(): string {
    return this.props.appId;
  }

  get key(): string {
    return this.props.key;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get clientExposed(): boolean {
    return this.props.clientExposed;
  }

  get lastEvaluatedAt(): Date | null {
    return this.props.lastEvaluatedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Same flag with other details; the key cannot change. */
  withDetails(details: FeatureFlagDetails): FeatureFlag {
    return new FeatureFlag({
      ...this.props,
      name: details.name ?? this.props.name,
      description:
        details.description === undefined
          ? this.props.description
          : details.description,
      clientExposed: details.clientExposed ?? this.props.clientExposed,
    });
  }

  /** Deleting a flag that is on somewhere turns the feature off for its consumers. */
  deletionNeedsConfirmation(values: FlagValue[]): boolean {
    return values.some((value) => value.flagId === this.id && value.enabled);
  }

  isDeletionConfirmedBy(confirm: string | undefined): boolean {
    return confirm === this.props.key;
  }
}

import { Slug } from '../shared/slug';

export interface FeatureFlagProps {
  id: string;
  appId: string;
  key: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

/**
 * FeatureFlag is identified within its App by a slug-like `key`
 * (e.g. "new-checkout-flow"). Its on/off state per environment is
 * represented by FlagValue.
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

  get createdAt(): Date {
    return this.props.createdAt;
  }
}

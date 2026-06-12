import { Slug } from '../shared/slug';

export interface EnvironmentProps {
  id: string;
  appId: string;
  name: string;
  slug: string;
  order: number;
  createdAt: Date;
}

/**
 * Environment represents a deployment target (e.g. "production",
 * "staging") within an App. FlagValues and ConfigValues are scoped per
 * environment.
 */
export class Environment {
  private constructor(private readonly props: EnvironmentProps) {
    if (!props.name.trim()) {
      throw new Error('Environment name must not be empty');
    }
    if (!Number.isInteger(props.order) || props.order < 0) {
      throw new Error('Environment order must be a non-negative integer');
    }
    // Validates the slug format; throws if invalid.
    Slug.create(props.slug);
  }

  static create(props: EnvironmentProps): Environment {
    return new Environment(props);
  }

  get id(): string {
    return this.props.id;
  }

  get appId(): string {
    return this.props.appId;
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): string {
    return this.props.slug;
  }

  get order(): number {
    return this.props.order;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}

import { Slug } from '../shared/slug';

export interface AppProps {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
}

/**
 * App is the aggregate root for a project being managed (e.g. "E-commerce
 * Core"). It owns environments, feature flags and config entries.
 */
export class App {
  private constructor(private readonly props: AppProps) {
    if (!props.name.trim()) {
      throw new Error('App name must not be empty');
    }
    // Validates the slug format; throws if invalid.
    Slug.create(props.slug);
  }

  static create(props: AppProps): App {
    return new App(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get name(): string {
    return this.props.name;
  }

  get slug(): string {
    return this.props.slug;
  }

  get description(): string | null {
    return this.props.description;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}

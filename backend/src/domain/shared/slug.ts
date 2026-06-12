const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Slug value object: a URL-safe identifier (lowercase letters, digits and
 * single hyphens, no leading/trailing/consecutive hyphens).
 */
export class Slug {
  private constructor(private readonly value: string) {
    if (!SLUG_PATTERN.test(value)) {
      throw new Error(
        `Invalid slug "${value}": must be lowercase alphanumeric with single hyphens`,
      );
    }
  }

  static create(value: string): Slug {
    return new Slug(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Slug): boolean {
    return this.value === other.value;
  }
}

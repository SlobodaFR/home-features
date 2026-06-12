/**
 * Converts a free-form label into a URL-safe slug matching the backend's
 * slug format (lowercase letters, digits and single hyphens).
 */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

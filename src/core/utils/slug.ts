/**
 * Slug utilities — used for org slugs in URLs.
 */

const SLUG_BASE = /[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;

/** Convert any string into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Validate a slug. */
export function isSlug(input: string): boolean {
  if (input.length < 3 || input.length > 60) return false;
  return new RegExp(`^${SLUG_BASE.source}$`).test(input);
}

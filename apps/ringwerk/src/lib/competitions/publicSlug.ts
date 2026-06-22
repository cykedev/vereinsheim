// Pure helpers — safe to import from Client Components.
// DB-touching functions live in ./publicSlugQueries.ts (server-only).

/** Valid public slug: lowercase alphanumeric + single dashes, 3–60 chars, no leading/trailing dash, no double-dash. */
export const SLUG_REGEX = /^(?=.{3,60}$)[a-z0-9]+(-[a-z0-9]+)*$/

const UMLAUT_MAP: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
  Ä: "ae",
  Ö: "oe",
  Ü: "ue",
}

/**
 * Convert a competition name into a URL-safe slug.
 * - Lowercase
 * - German umlauts transliterated (ä→ae, ö→oe, ü→ue, ß→ss)
 * - Everything except [a-z0-9] becomes a dash
 * - Collapse multiple dashes, trim from both ends
 * Returns empty string if nothing valid remains. Length is NOT clamped — callers must check SLUG_REGEX
 * (which enforces 3–60 chars when used with .test()) before storing.
 */
export function slugify(name: string): string {
  const transliterated = name.replace(/[äöüßÄÖÜ]/g, (c) => UMLAUT_MAP[c] ?? c)
  const lowered = transliterated.toLowerCase()
  const dashed = lowered.replace(/[^a-z0-9]+/g, "-")
  return dashed.replace(/^-+|-+$/g, "")
}

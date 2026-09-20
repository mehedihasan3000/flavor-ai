/**
 * Ingredient key normalization — owned by Dev A (Workstream A, FEATURES_TASKS.md §1.1).
 * Consumed by Workstreams B and C via import; never reimplemented.
 *
 * Purpose: map spelling variants of the same logical ingredient to one stable
 * key (`Tomato` / `tomatoes` / `Tomato` → `tomato`) so pantry dedup,
 * grocery consolidation, and pantry subtraction compare like-for-like.
 *
 * Deliberately conservative: the full phrase is preserved token-by-token, so
 * genuinely different ingredients never merge
 * (`chicken breast` ≠ `chicken thigh`).
 */

/** Plural suffixes that take `-es` in English (`peach` → `peaches`). */
const ES_SUFFIXES = /(ches|shes|sses|xes|zes|oes)$/;

/**
 * Plurals whose singular ends in `-ie` (plural just adds `s`), where the
 * naive `ies → y` fold would fork the key (`cookies` → `cooky` vs `cookie`).
 * Food-domain list; exact repeats still dedup either way, this only unites
 * mixed singular/plural inputs.
 */
const IE_SINGULAR_PLURALS = new Set([
  "beanies",
  "brownies",
  "calories",
  "cookies",
  "pies",
  "smoothies",
  "veggies",
]);

/**
 * Naive English singular fold for a single lowercase alphanumeric token.
 * Handles the grocery-relevant cases (`tomatoes→tomato`, `onions→onion`,
 * `berries→berry`) without a dictionary. Words ≤3 chars and `ss` endings
 * (`glass`, `class`) are left untouched.
 */
function singularizeToken(token: string): string {
  if (token.length <= 3) return token;
  if (IE_SINGULAR_PLURALS.has(token)) return token.slice(0, -1);
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (ES_SUFFIXES.test(token)) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

/**
 * Normalizes an ingredient name to its stable pantry/grocery key.
 * Steps: lowercase → strip diacritics → punctuation to spaces →
 * collapse whitespace → per-token naive plural fold.
 *
 * Punctuation becomes a space (not deleted) so `chicken-breast` and
 * `chicken breast` share a key instead of forking into
 * `chickenbreast` vs `chicken breast`. Diacritics fold to ASCII so
 * `jalapeño` and `jalapeno` share a key. Non-string input returns `""`
 * (mirrors the `units.ts` guards) instead of throwing.
 */
export function normalizeIngredientKey(name: string): string {
  if (typeof name !== "string") return "";
  const cleaned = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned.split(" ").map(singularizeToken).join(" ");
}

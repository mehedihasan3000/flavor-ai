const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

/**
 * Escapes regex metacharacters in user-supplied search text before it is
 * used to build a `RegExp` (e.g. admin `q` filters). Prevents malformed or
 * catastrophic patterns from untrusted input (NFR-SEC-05, injection).
 */
export function escapeRegExp(value: string): string {
  return value.replace(REGEX_SPECIAL_CHARS, "\\$&");
}

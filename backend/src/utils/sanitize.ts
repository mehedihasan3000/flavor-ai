const HTML_TAG = /<[^>]*>/g;
const REPEAT_SPACES = /[ \t]+/g;
const SPACE_AROUND_NEWLINE = /[ \t]*\n[ \t]*/g;

// C0 control codes minus tab (9), LF (10), CR (13) — built from char codes
// instead of literal \u escapes so no raw control bytes live in source.
const CONTROL_CHAR_CLASS = Array.from({ length: 32 }, (_, code) => code)
  .filter((code) => code !== 9 && code !== 10 && code !== 13)
  .map((code) => String.fromCharCode(code))
  .join("");
const CONTROL_CHARS = new RegExp(`[${CONTROL_CHAR_CLASS}]`, "g");

/**
 * Strips markup and control characters from user-submitted plain text
 * (comments have no rich-text format) before it is validated/stored.
 * Defense-in-depth for FR-COMMENT-04 / NFR-SEC-06 — rendering must still
 * escape output, but stored content should never carry executable markup.
 */
export function sanitizePlainText(input: string): string {
  return input
    .replace(HTML_TAG, " ") // strip HTML/XML tags (incl. <script>, <img onerror=...>)
    .replace(CONTROL_CHARS, "") // strip control chars (keep \t and \n)
    .replace(REPEAT_SPACES, " ") // collapse runs of spaces/tabs left by stripped tags
    .replace(SPACE_AROUND_NEWLINE, "\n") // trim spaces hugging newlines
    .trim();
}

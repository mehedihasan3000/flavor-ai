/**
 * Sanitizes a redirect/callback URL to prevent open redirect vulnerabilities (CWE-601).
 * Ensures the target is a relative path on the same origin (starts with '/' and not '//' or '/\\').
 */
export function getSafeCallbackUrl(
  raw: string | null | undefined,
  fallback = "/profile",
): string {
  if (!raw || typeof raw !== "string") {
    return fallback;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }

  // Must start with exactly one forward slash, followed by a non-slash character
  // Disallow '//', '/\', and protocol-relative or backslash-escaped URLs
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }

  return fallback;
}

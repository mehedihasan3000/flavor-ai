/**
 * Turns a kebab-case contract enum value (e.g. "main-course", "gluten-free")
 * into a human-readable label ("Main Course", "Gluten Free"). Shared across
 * recipe filters/badges so labels stay consistent wherever an enum is shown.
 */
export function formatEnumLabel(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Unit conversion — owned by Dev A (Workstream A, FEATURES_TASKS.md §1.1).
 * Consumed by Workstream C via import; never reimplemented.
 *
 * Frozen allowlist (metric + kitchen only): `g | kg | ml | l | pcs | tbsp | tsp | cup`.
 * Anything else (incl. `oz | lb` and unknown strings) is display-only:
 * `toBaseUnit` returns `null`, `unitGroup` returns `"other"`, and
 * `convertQuantity` returns `null` for cross-unit pairs so callers keep
 * separate lines instead of over-buying from a bad conversion.
 *
 * Conversion table:
 * - mass: `g ↔ kg` (factor 1000), base `g`
 * - volume: `ml ↔ l` (factor 1000), `tsp ↔ tbsp ↔ cup ↔ ml`
 *   (`1 tbsp = 3 tsp`, `1 cup = 16 tbsp = 240 ml`), `cup ↔ l` via ml, base `ml`
 * - count: `pcs` converts to nothing (identity only), base `pcs`
 */

export type UnitGroup = "mass" | "volume" | "count" | "other";

export interface BaseUnit {
  base: string;
  factor: number;
}

const MASS_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
};

/** Normalizes a unit string for comparison (`KG` → `kg`). */
function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

/**
 * Classifies a unit into its conversion group. Only the frozen allowlist
 * maps to `mass` / `volume` / `count`; everything else is `other`.
 */
export function unitGroup(unit: string): UnitGroup {
  if (typeof unit !== "string") return "other";
  const u = normalizeUnit(unit);
  if (Object.hasOwn(MASS_TO_G, u)) return "mass";
  if (Object.hasOwn(VOLUME_TO_ML, u)) return "volume";
  if (u === "pcs") return "count";
  return "other";
}

/**
 * Resolves a unit to its canonical base (`mass→g`, `volume→ml`, `count→pcs`)
 * plus the multiplicative factor (`qtyInBase = qty * factor`).
 * Returns `null` for imperial/unknown units (`oz`, `lb`, `bunch`, …).
 */
export function toBaseUnit(unit: string): BaseUnit | null {
  if (typeof unit !== "string") return null;
  const u = normalizeUnit(unit);
  if (Object.hasOwn(MASS_TO_G, u)) return { base: "g", factor: MASS_TO_G[u] };
  if (Object.hasOwn(VOLUME_TO_ML, u)) return { base: "ml", factor: VOLUME_TO_ML[u] };
  if (u === "pcs") return { base: "pcs", factor: 1 };
  return null;
}

/**
 * Converts `qty` from one unit to another. Returns `null` when no reliable
 * conversion exists (incompatible groups, imperial/unknown units) so callers
 * keep separate lines.
 *
 * Same normalized unit is identity (returns `qty` as-is, no conversion):
 * `pcs→pcs` works, and same-unit imperial/unknown pairs (e.g. `oz→oz`)
 * subtract safely with factor 1. Cross-unit imperial (`oz→g`, `oz→lb`)
 * returns `null`.
 */
export function convertQuantity(qty: number, from: string, to: string): number | null {
  if (typeof qty !== "number" || !Number.isFinite(qty)) return null;
  if (typeof from !== "string" || typeof to !== "string") return null;
  const fromNorm = normalizeUnit(from);
  const toNorm = normalizeUnit(to);
  if (fromNorm === toNorm) return qty;

  const fromBase = toBaseUnit(fromNorm);
  const toBase = toBaseUnit(toNorm);
  if (!fromBase || !toBase) return null;
  if (fromBase.base !== toBase.base) return null;
  return (qty * fromBase.factor) / toBase.factor;
}

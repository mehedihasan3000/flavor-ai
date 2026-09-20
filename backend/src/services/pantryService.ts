import type { HydratedDocument } from "mongoose";
import { PantryItemModel, type PantryItem } from "../models/PantryItem.js";
import { PantryCategory } from "../types/index.js";
import { normalizeIngredientKey } from "../utils/ingredientKey.js";
import { sanitizePlainText } from "../utils/sanitize.js";
import { convertQuantity } from "../utils/units.js";

/**
 * Pantry service — owned by Dev A (Workstream A, FEATURES_TASKS.md §1.4, §A2).
 * Home of the C→A seam: Workstream C calls `upsertPantryFromGrocery` and
 * never imports the `PantryItem` model directly.
 */

// ---------------------------------------------------------------------------
// Shared merge lookup (also used by the pantry controller's create flow)
// ---------------------------------------------------------------------------

/**
 * Finds the caller's pantry line that a quantity in `unit` can merge into:
 * same `userId` + `ingredientKey` with a convertible unit (identity counts,
 * so exact-unit matches qualify — callers check exact-first when they need
 * to distinguish 409-vs-merge). Returns `null` when no merge target exists
 * and the caller should create a new line.
 */
export async function findConvertiblePantryItem(
  userId: string,
  ingredientKey: string,
  unit: string,
): Promise<HydratedDocument<PantryItem> | null> {
  const candidates = await PantryItemModel.find({ userId, ingredientKey }).exec();
  for (const candidate of candidates) {
    if (convertQuantity(1, unit, candidate.unit) !== null) return candidate;
  }
  return null;
}

// ---------------------------------------------------------------------------
// C→A seam: purchased grocery items → pantry
// ---------------------------------------------------------------------------

/** Minimal grocery-item shape Dev C passes in (its model stays C-owned). */
export interface PurchasedGroceryItem {
  groceryItemId: string;
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  movedToPantry?: boolean;
}

export type PantryUpsertStatus = "moved" | "skipped_already_moved" | "invalid";

export interface PantryUpsertResult {
  groceryItemId: string;
  status: PantryUpsertStatus;
  /** Pantry line created/merged into (`null` unless `moved`). */
  pantryItemId: string | null;
  /** Resulting pantry quantity/unit after the move (present when `moved`). */
  quantity?: number;
  unit?: string;
  /** Machine-readable reason for `skipped`/`invalid` outcomes. */
  reason?: string;
}

function toValidCategory(raw: unknown): string {
  const parsed = PantryCategory.safeParse(raw);
  return parsed.success ? parsed.data : "other";
}

/** Creates a fresh pantry line for a moved grocery item (no merge target). */
async function createPantryLine(
  userId: string,
  ingredientKey: string,
  cleanName: string,
  qty: number,
  cleanUnit: string,
  category: unknown,
): Promise<HydratedDocument<PantryItem>> {
  return PantryItemModel.create({
    userId,
    ingredientKey,
    name: cleanName,
    quantity: qty,
    unit: cleanUnit,
    category: toValidCategory(category),
    expiryDate: null,
    lowStockThreshold: null,
    notes: "",
  });
}

/**
 * Upserts purchased grocery items into the caller's pantry.
 *
 * - Items already flagged `movedToPantry` are skipped + reported
 *   (double-POST is a safe no-op, never a double-add).
 * - Exact `ingredientKey + unit` matches sum quantities into the existing line.
 * - Convertible units merge via `units.ts` (`500g` pantry + `1kg` purchased
 *   → `1500g`); incompatible/imperial units create a separate line.
 * - Pantry-side increments are atomic (`$inc`); the grocery-side
 *   `movedToPantry` flag is cooperative (checked here, persisted by the
 *   caller, which owns the GroceryList model) — Dev C's controller must
 *   re-check the persisted flag before calling so overlapping duplicate
 *   POSTs cannot both merge. Full cross-document atomicity is not possible
 *   without breaking §0.2 exclusive ownership.
 * - On each successful move the input's `movedToPantry` is set to `true` —
 *   the caller persists its own documents (this service never imports the
 *   GroceryList model, preserving §0.2 exclusive ownership).
 */
export async function upsertPantryFromGrocery(
  userId: string,
  items: PurchasedGroceryItem[],
): Promise<PantryUpsertResult[]> {
  const results: PantryUpsertResult[] = [];

  for (const item of items) {
    if (item.movedToPantry === true) {
      results.push({
        groceryItemId: item.groceryItemId,
        status: "skipped_already_moved",
        pantryItemId: null,
        reason: "already_moved",
      });
      continue;
    }

    const cleanName =
      typeof item.name === "string" ? sanitizePlainText(item.name) : "";
    const cleanUnit =
      typeof item.unit === "string" ? sanitizePlainText(item.unit) : "";
    const qty = item.quantity;
    if (
      !cleanName ||
      cleanName.length > 100 ||
      !cleanUnit ||
      cleanUnit.length > 30 ||
      typeof qty !== "number" ||
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      results.push({
        groceryItemId: item.groceryItemId,
        status: "invalid",
        pantryItemId: null,
        reason: "invalid_item",
      });
      continue;
    }

    const ingredientKey = normalizeIngredientKey(cleanName);
    if (!ingredientKey) {
      results.push({
        groceryItemId: item.groceryItemId,
        status: "invalid",
        pantryItemId: null,
        reason: "invalid_item",
      });
      continue;
    }

    const target = await findConvertiblePantryItem(userId, ingredientKey, cleanUnit);
    if (target) {
      const converted = convertQuantity(qty, cleanUnit, target.unit);
      if (converted === null) {
        // Unreachable via `findConvertiblePantryItem` (it guarantees a
        // convertible target); fail safe with a separate line rather than
        // adding a quantity expressed in the wrong unit.
      } else {
        const updated = await PantryItemModel.findOneAndUpdate(
          { _id: target._id, userId },
          { $inc: { quantity: converted } },
          { new: true },
        ).exec();
        if (updated) {
          item.movedToPantry = true;
          results.push({
            groceryItemId: item.groceryItemId,
            status: "moved",
            pantryItemId: String(updated._id),
            quantity: updated.quantity,
            unit: updated.unit,
          });
          continue;
        }
        // Line vanished between lookup and update; fall through and create
        // a fresh line below.
      }
    } else {
      const created = await createPantryLine(
        userId,
        ingredientKey,
        cleanName,
        qty,
        cleanUnit,
        item.category,
      );
      item.movedToPantry = true;
      results.push({
        groceryItemId: item.groceryItemId,
        status: "moved",
        pantryItemId: String(created._id),
        quantity: created.quantity,
        unit: created.unit,
      });
      continue;
    }

    const created = await createPantryLine(
      userId,
      ingredientKey,
      cleanName,
      qty,
      cleanUnit,
      item.category,
    );
    item.movedToPantry = true;
    results.push({
      groceryItemId: item.groceryItemId,
      status: "moved",
      pantryItemId: String(created._id),
      quantity: created.quantity,
      unit: created.unit,
    });
  }

  return results;
}

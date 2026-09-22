import type { PantryCategory } from "../types/index.js";
import { normalizeIngredientKey } from "../utils/ingredientKey.js";
import { convertQuantity, toBaseUnit } from "../utils/units.js";

/**
 * Grocery math — owned by Dev C (Workstream C, FEATURES_TASKS.md §C1).
 *
 * Pure deterministic logic: zero DB, zero AI. All arithmetic (consolidation,
 * serving scaling, pantry subtraction) lives here so it is fully unit-tested
 * and never delegated to the LLM (§0.1, §0.3.6).
 *
 * Pipeline: `consolidateRequirements` (scale + merge) → `subtractPantry`
 * (`toBuy = max(0, required − pantry)` per key + convertible unit) → persist.
 * `categorize` is a keyword map over the item name (no AI call, §1.1).
 *
 * Shared vocabulary comes from Dev A (never reimplemented here):
 * `normalizeIngredientKey` for the name part of each key, `units.ts` for
 * canonical base units and conversions. Imperial/unknown units never merge
 * or convert across units — but same-unit pairs share a key and subtract
 * safely (`2oz` + `1oz` → `3oz`), matching `units.ts` identity semantics.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One recipe's contribution to the total requirement (pre-scale). */
export interface GroceryRequirementIngredient {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

/** All ingredients of one meal plus how to scale them to the meal servings. */
export interface GroceryMealRequirements {
  /** Recipe the ingredients were read from (tracked in `sourceRecipeIds`). */
  recipeId?: string;
  /** `meal.servings / recipe.servings`. Defaults to 1 when missing/invalid. */
  servingsScale?: number | null;
  ingredients: GroceryRequirementIngredient[];
}

/**
 * One consolidated grocery line.
 * `key` = `normalizeIngredientKey(name) + "|" + canonicalUnit`, where the
 * canonical unit is the `toBaseUnit` base (`g`/`ml`/`pcs`) or the normalized
 * raw unit for imperial/unknown units (those lines never merge across units).
 */
export interface ConsolidatedItem {
  key: string;
  /** First-seen display name (trimmed, original casing preserved). */
  name: string;
  /** Quantity expressed in `unit` (already scaled + summed). */
  quantity: number;
  /** Canonical base unit, or the normalized raw unit when unconvertible. */
  unit: string;
  category: PantryCategory;
  sourceRecipeIds: string[];
  /** True when any contributing line had no usable quantity (amount guessed). */
  estimated: boolean;
}

/** Minimal pantry stock shape the subtraction needs (Dev-A `PantryItem`). */
export interface PantryStockItem {
  /** Normalized name key when known; otherwise derived from `name`. */
  ingredientKey?: string;
  name?: string;
  quantity: number;
  unit: string;
}

export interface PantrySubtractionResult {
  /** Amounts still to buy (`quantity` already reduced by pantry stock). */
  toBuy: ConsolidatedItem[];
  /** Requirements fully covered by the pantry (kept for transparency). */
  covered: ConsolidatedItem[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Remainders at or below this are treated as fully covered (float noise). */
const COVERED_EPSILON = 1e-9;

/** Rounds to 3 decimals so scaled/subtracted amounts stay display-clean. */
function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function normalizeRawUnit(unit: unknown): string {
  return typeof unit === "string" ? unit.trim().toLowerCase() : "";
}

function positiveScale(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 1;
}

// ---------------------------------------------------------------------------
// categorize
// ---------------------------------------------------------------------------

/**
 * Extendable keyword map. Order matters: earlier categories win on overlap
 * (`black pepper` → spices before vegetables sees bare `pepper`;
 * `egg noodle` → grains before dairy sees bare `egg`).
 * Matching is whole-token on the normalized key, so `eggplant` never matches
 * dairy `egg` and `cornstarch` never matches vegetable `corn`.
 * `frozen` stays last: it is a storage form, matched only when no kind is
 * known (`frozen peas` → vegetables, `frozen dinner` → frozen).
 */
export const GROCERY_CATEGORY_KEYWORDS: ReadonlyArray<{
  readonly category: PantryCategory;
  readonly keywords: ReadonlyArray<string>;
}> = [
  {
    category: "meat",
    keywords: [
      "chicken",
      "beef",
      "pork",
      "turkey",
      "lamb",
      "veal",
      "duck",
      "goose",
      "venison",
      "rabbit",
      "bacon",
      "sausage",
      "ham",
      "salami",
      "pepperoni",
      "chorizo",
      "prosciutto",
      "steak",
      "mince",
      "minced",
      "meatball",
      "meat",
      "fish",
      "salmon",
      "tuna",
      "shrimp",
      "prawn",
      "crab",
      "lobster",
      "mussel",
      "clam",
      "oyster",
      "squid",
      "octopus",
      "anchovy",
      "sardine",
      "trout",
      "cod",
      "haddock",
    ],
  },
  {
    category: "grains",
    keywords: [
      "rice",
      "flour",
      "bread",
      "breadcrumb",
      "pasta",
      "noodle",
      "egg noodle",
      "spaghetti",
      "macaroni",
      "penne",
      "fusilli",
      "lasagna",
      "ramen",
      "oat",
      "wheat",
      "barley",
      "quinoa",
      "couscous",
      "cereal",
      "cornmeal",
      "cornstarch",
      "cornflour",
      "tortilla",
      "bun",
      "bagel",
      "millet",
      "rye",
      "farro",
      "bulgur",
      "buckwheat",
      "amaranth",
      "sorghum",
      "semolina",
      "panko",
      "lentil",
      "grain",
    ],
  },
  {
    category: "dairy",
    keywords: [
      "milk",
      "egg",
      "cheese",
      "butter",
      "yogurt",
      "yoghurt",
      "cream",
      "sour cream",
      "whipped cream",
      "heavy cream",
      "ghee",
      "paneer",
      "curd",
      "whey",
      "kefir",
      "mozzarella",
      "cheddar",
      "parmesan",
      "feta",
      "ricotta",
      "cottage cheese",
    ],
  },
  {
    category: "spices",
    keywords: [
      "salt",
      "black pepper",
      "white pepper",
      "peppercorn",
      "onion powder",
      "garlic powder",
      "cumin",
      "turmeric",
      "paprika",
      "cinnamon",
      "cardamom",
      "clove",
      "coriander",
      "curry",
      "masala",
      "garam masala",
      "oregano",
      "basil",
      "thyme",
      "rosemary",
      "parsley",
      "cilantro",
      "dill",
      "mint",
      "bay leaf",
      "chili",
      "chilli",
      "cayenne",
      "saffron",
      "nutmeg",
      "mustard",
      "cumin seed",
      "fennel seed",
      "spice",
      "seasoning",
      "herb",
      "powder",
    ],
  },
  {
    category: "vegetables",
    keywords: [
      "onion",
      "tomato",
      "potato",
      "sweet potato",
      "carrot",
      "spinach",
      "lettuce",
      "cabbage",
      "broccoli",
      "cauliflower",
      "kale",
      "bell pepper",
      "pepper",
      "pea",
      "bean",
      "green bean",
      "chickpea",
      "chick pea",
      "garbanzo",
      "cucumber",
      "garlic",
      "ginger",
      "mushroom",
      "corn",
      "sweetcorn",
      "celery",
      "zucchini",
      "courgette",
      "eggplant",
      "aubergine",
      "okra",
      "radish",
      "beet",
      "beetroot",
      "turnip",
      "parsnip",
      "leek",
      "shallot",
      "scallion",
      "chive",
      "asparagus",
      "artichoke",
      "brussel sprout",
      "sprout",
      "squash",
      "pumpkin",
      "yam",
      "fennel",
      "arugula",
      "rocket",
      "endive",
      "radicchio",
      "bok choy",
      "choy",
      "greens",
      "salad",
      "olive",
      "tofu",
      "veggie",
      "vegetable",
    ],
  },
  {
    category: "fruits",
    keywords: [
      "apple",
      "banana",
      "orange",
      "lemon",
      "lime",
      "berry",
      "strawberry",
      "blueberry",
      "raspberry",
      "blackberry",
      "cranberry",
      "mango",
      "pineapple",
      "grape",
      "peach",
      "pear",
      "plum",
      "cherry",
      "kiwi",
      "melon",
      "watermelon",
      "cantaloupe",
      "honeydew",
      "apricot",
      "nectarine",
      "papaya",
      "guava",
      "fig",
      "date",
      "pomegranate",
      "coconut",
      "avocado",
      "tangerine",
      "clementine",
      "grapefruit",
      "citrus",
      "persimmon",
      "lychee",
      "passion fruit",
      "dragon fruit",
      "fruit",
    ],
  },
  {
    category: "snacks",
    keywords: [
      "chip",
      "crisp",
      "cracker",
      "cookie",
      "brownie",
      "chocolate",
      "candy",
      "biscuit",
      "popcorn",
      "pretzel",
      "peanut",
      "almond",
      "cashew",
      "walnut",
      "pistachio",
      "hazelnut",
      "pecan",
      "nut",
      "granola",
      "wafer",
      "snack",
    ],
  },
  {
    category: "frozen",
    keywords: ["frozen"],
  },
];

/**
 * Classifies an item name into a pantry/grocery category (§1.1).
 * `ice cream` is pinned to `frozen` (otherwise dairy `cream` would claim it);
 * cooking `oil` falls through to `other` (no grocery category fits it).
 * Unknown or empty names → `other`.
 */
export function categorize(name: string): PantryCategory {
  if (typeof name !== "string") return "other";
  const key = normalizeIngredientKey(name);
  if (!key) return "other";
  if (key.includes("ice cream") || key.includes("icecream")) return "frozen";
  const tokens = new Set(key.split(" "));
  if (tokens.has("oil")) return "other";
  const haystack = ` ${key} `;
  for (const { category, keywords } of GROCERY_CATEGORY_KEYWORDS) {
    for (const keyword of keywords) {
      if (haystack.includes(` ${keyword} `)) return category;
    }
  }
  return "other";
}

// ---------------------------------------------------------------------------
// consolidateRequirements
// ---------------------------------------------------------------------------

/**
 * Scales every meal's ingredients by its `servingsScale` and merges
 * same-key lines (`normalizeIngredientKey(name) + "|" + canonicalUnit`).
 *
 * - Compatible units merge via Dev-A `units.ts` (`500g` + `1kg` → `1500g`
 *   in canonical `g`); imperial/unknown units keep their raw unit in the key
 *   and never merge across units; `pcs` merges with nothing but `pcs`.
 * - Missing/non-finite quantity → `{ quantity: 1, unit: "pcs" (or the given
 *   unit when one was provided), estimated: true }`.
 * - A merged line is `estimated` when any contributing line was estimated.
 * - Lines with an empty name are skipped (they cannot be keyed).
 * - Zero scaled quantities contribute nothing: a `quantity: 0` line is
 *   skipped instead of emitting a phantom zero-amount entry.
 */
export function consolidateRequirements(
  meals: GroceryMealRequirements[],
): ConsolidatedItem[] {
  const merged = new Map<string, ConsolidatedItem>();
  if (!Array.isArray(meals)) return [];

  for (const meal of meals) {
    if (!meal || !Array.isArray(meal.ingredients)) continue;
    const scale = positiveScale(meal.servingsScale);
    const recipeId =
      typeof meal.recipeId === "string" && meal.recipeId ? meal.recipeId : null;

    for (const ingredient of meal.ingredients) {
      if (!ingredient || typeof ingredient.name !== "string") continue;
      const displayName = ingredient.name.trim();
      const normalizedName = normalizeIngredientKey(ingredient.name);
      if (!displayName || !normalizedName) continue;

      let estimated = false;
      let quantity: number;
      if (
        typeof ingredient.quantity !== "number" ||
        !Number.isFinite(ingredient.quantity)
      ) {
        quantity = 1;
        estimated = true;
      } else {
        quantity = Math.max(0, ingredient.quantity);
      }

      const effectiveUnit = normalizeRawUnit(ingredient.unit) || "pcs";
      const base = toBaseUnit(effectiveUnit);
      const canonicalUnit = base ? base.base : effectiveUnit;
      const canonicalQuantity = round3(quantity * scale * (base ? base.factor : 1));
      // Zero scaled quantities contribute nothing — skip instead of emitting
      // a phantom zero-amount line (it would otherwise land in `covered`).
      if (canonicalQuantity <= 0) continue;
      const key = `${normalizedName}|${canonicalUnit}`;

      const existing = merged.get(key);
      if (existing) {
        existing.quantity = round3(existing.quantity + canonicalQuantity);
        existing.estimated = existing.estimated || estimated;
        if (recipeId && !existing.sourceRecipeIds.includes(recipeId)) {
          existing.sourceRecipeIds.push(recipeId);
        }
      } else {
        merged.set(key, {
          key,
          name: displayName,
          quantity: canonicalQuantity,
          unit: canonicalUnit,
          category: categorize(displayName),
          sourceRecipeIds: recipeId ? [recipeId] : [],
          estimated,
        });
      }
    }
  }

  return [...merged.values()];
}

// ---------------------------------------------------------------------------
// subtractPantry
// ---------------------------------------------------------------------------

/**
 * Subtracts pantry stock from consolidated requirements (§5 formula):
 * `toBuy = max(0, required − pantry)` per ingredient key + convertible unit.
 *
 * Pantry lines are grouped by normalized name; each convertible line is
 * converted into the requirement's unit via Dev-A `units.ts` and summed.
 * `convertQuantity` returning `null` (incompatible/imperial pairs) means no
 * subtraction for that line. Fully covered requirements (remainder within
 * epsilon of zero) move to `covered` for transparency instead of `toBuy`.
 */
export function subtractPantry(
  requirements: ConsolidatedItem[],
  pantryItems: PantryStockItem[],
): PantrySubtractionResult {
  const toBuy: ConsolidatedItem[] = [];
  const covered: ConsolidatedItem[] = [];
  if (!Array.isArray(requirements)) return { toBuy, covered };
  const stock = Array.isArray(pantryItems) ? pantryItems : [];

  const pantryByName = new Map<string, Array<{ quantity: number; unit: string }>>();
  for (const item of stock) {
    if (!item) continue;
    const normalizedName =
      typeof item.ingredientKey === "string" && item.ingredientKey.trim()
        ? normalizeIngredientKey(item.ingredientKey)
        : typeof item.name === "string"
          ? normalizeIngredientKey(item.name)
          : "";
    if (!normalizedName) continue;
    if (
      typeof item.quantity !== "number" ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0
    ) {
      continue;
    }
    const unit = normalizeRawUnit(item.unit);
    if (!unit) continue;
    const entry = { quantity: item.quantity, unit };
    const group = pantryByName.get(normalizedName);
    if (group) group.push(entry);
    else pantryByName.set(normalizedName, [entry]);
  }

  for (const requirement of requirements) {
    const separator = requirement.key.lastIndexOf("|");
    const requirementName =
      separator >= 0
        ? requirement.key.slice(0, separator)
        : normalizeIngredientKey(requirement.name);

    let available = 0;
    const candidates = pantryByName.get(requirementName);
    if (candidates) {
      for (const candidate of candidates) {
        const converted = convertQuantity(
          candidate.quantity,
          candidate.unit,
          requirement.unit,
        );
        if (converted !== null) available += converted;
      }
    }

    const remaining = requirement.quantity - available;
    if (remaining <= COVERED_EPSILON) {
      covered.push({ ...requirement });
    } else {
      toBuy.push({ ...requirement, quantity: round3(remaining) });
    }
  }

  return { toBuy, covered };
}

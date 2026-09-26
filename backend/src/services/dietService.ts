import type {
  DietPlanFoodItem,
  DietPlanInput,
  DietPlanResult,
} from "../types/index.js";

/**
 * Personalized Diet Plan & Nutrition Requirement Calculator (INFO.md feature).
 *
 * Deterministic estimates — no AI provider involved:
 * - BMI                = weightKg / heightM^2 (WHO cut-offs for the category)
 * - BMR                = Mifflin-St Jeor equation (kcal/day)
 * - Daily calories     = BMR x standard activity factor
 * - Daily protein      = weight-based g/kg/day band per activity level
 * - Food plan          = protein-rich foods (meat, egg, dairy, legumes, …)
 *                        portioned to approximately cover the protein target,
 *                        filtered by the optional dietary preference.
 *
 * All outputs are approximations for general guidance only (see disclaimer).
 */

// --- Formula tables ----------------------------------------------------------

const ACTIVITY_FACTOR: Record<DietPlanInput["activityLevel"], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  "very-active": 1.9,
};

/** Protein g per kg of body weight per day, by activity level. */
const PROTEIN_PER_KG: Record<DietPlanInput["activityLevel"], { min: number; estimate: number; max: number }> = {
  sedentary: { min: 0.8, estimate: 1.0, max: 1.2 },
  light: { min: 1.0, estimate: 1.2, max: 1.4 },
  moderate: { min: 1.2, estimate: 1.5, max: 1.8 },
  active: { min: 1.4, estimate: 1.7, max: 2.0 },
  "very-active": { min: 1.6, estimate: 1.9, max: 2.2 },
};

export interface ProteinFood {
  food: string;
  /** Grams of protein per 100 g (null when portioned by unit instead). */
  proteinPer100g: number | null;
  /** Grams of protein per single unit (e.g. one large egg). */
  proteinPerUnit: number | null;
  unitLabel: string;
  vegan: boolean;
  vegetarian: boolean;
  dairyFree: boolean;
  /** Low-carbohydrate friendly (excludes legumes and other starchy foods). */
  lowCarb: boolean;
  note: string;
}

/** Approximate protein content (cooked weights unless noted). */
const PROTEIN_FOODS: ProteinFood[] = [
  { food: "Chicken breast (skinless)", proteinPer100g: 31, proteinPerUnit: null, unitLabel: "g", vegan: false, vegetarian: false, dairyFree: true, lowCarb: true, note: "Cooked weight" },
  { food: "Eggs", proteinPer100g: null, proteinPerUnit: 6, unitLabel: "large egg", vegan: false, vegetarian: true, dairyFree: true, lowCarb: true, note: "Boiled or poached" },
  { food: "Greek yogurt", proteinPer100g: 10, proteinPerUnit: null, unitLabel: "g", vegan: false, vegetarian: true, dairyFree: false, lowCarb: true, note: "Plain, low-fat" },
  { food: "Canned tuna", proteinPer100g: 24, proteinPerUnit: null, unitLabel: "g", vegan: false, vegetarian: false, dairyFree: true, lowCarb: true, note: "Drained weight" },
  { food: "Lentils (cooked)", proteinPer100g: 9, proteinPerUnit: null, unitLabel: "g", vegan: true, vegetarian: true, dairyFree: true, lowCarb: false, note: "Boiled, no added fat" },
  { food: "Chickpeas (cooked)", proteinPer100g: 9, proteinPerUnit: null, unitLabel: "g", vegan: true, vegetarian: true, dairyFree: true, lowCarb: false, note: "Boiled or roasted" },
  { food: "Firm tofu", proteinPer100g: 8, proteinPerUnit: null, unitLabel: "g", vegan: true, vegetarian: true, dairyFree: true, lowCarb: true, note: "Drained weight" },
  { food: "Peanuts", proteinPer100g: 26, proteinPerUnit: null, unitLabel: "g", vegan: true, vegetarian: true, dairyFree: true, lowCarb: true, note: "Dry-roasted, unsalted" },
  { food: "Paneer", proteinPer100g: 18, proteinPerUnit: null, unitLabel: "g", vegan: false, vegetarian: true, dairyFree: false, lowCarb: true, note: "Grilled or curried" },
];

/** Default omnivore plan, looked up by name so reordering PROTEIN_FOODS is safe. */
const DEFAULT_PLAN_FOODS = [
  "Chicken breast (skinless)",
  "Eggs",
  "Greek yogurt",
  "Lentils (cooked)",
];

function pickByName(...names: string[]): ProteinFood[] {
  return names.map((name) => PROTEIN_FOODS.find((f) => f.food === name) as ProteinFood);
}

/** Share of the daily protein target assigned to each plan slot. */
const PLAN_SHARES = [0.4, 0.3, 0.2, 0.1];

export const DIET_PLAN_DISCLAIMER =
  "These values are estimates for general guidance only and are not medical advice. Food suggestions are filtered on a best-effort basis and cannot guarantee compliance with dietary restrictions or allergen avoidance — always verify ingredients independently. Consult a registered dietitian or healthcare professional before making significant dietary changes.";

const round1 = (n: number): number => Math.round(n * 10) / 10;
const round5 = (n: number): number => Math.max(5, Math.round(n / 5) * 5);

// --- Exported helpers (unit-testable) -----------------------------------------

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return round1(weightKg / (heightM * heightM));
}

export function getBmiCategory(bmi: number): DietPlanResult["bmiCategory"] {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal weight";
  if (bmi < 30) return "Overweight";
  return "Obesity";
}

/**
 * Mifflin-St Jeor Basal Metabolic Rate, kcal/day (rounded, clamped at 0 —
 * schema-legal extreme inputs such as age 120 / weight 20 kg would otherwise
 * yield a negative rate).
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: DietPlanInput["sex"],
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.max(0, Math.round(sex === "male" ? base + 5 : base - 161));
}

/**
 * Pick protein-rich foods compatible with the optional dietary preference.
 * Best-effort filtering only (see disclaimer): labels without a specific
 * nutritional conflict (halal, gluten-free, high-protein) use the default
 * omnivore plan — the database contains no pork, and every item is
 * intrinsically gluten-free and protein-rich.
 */
export function selectProteinFoods(
  dietaryPreference?: DietPlanInput["dietaryPreference"],
): ProteinFood[] {
  if (dietaryPreference === "vegan") {
    return PROTEIN_FOODS.filter((f) => f.vegan);
  }
  if (dietaryPreference === "vegetarian") {
    return PROTEIN_FOODS.filter((f) => f.vegetarian);
  }
  if (dietaryPreference === "dairy-free") {
    return PROTEIN_FOODS.filter((f) => f.dairyFree);
  }
  if (dietaryPreference === "keto" || dietaryPreference === "low-carb") {
    return PROTEIN_FOODS.filter((f) => f.lowCarb);
  }
  return pickByName(...DEFAULT_PLAN_FOODS);
}

/** Portion plan items to approximately cover the protein target. */
export function buildFoodPlan(
  proteinTargetGrams: number,
  dietaryPreference?: DietPlanInput["dietaryPreference"],
): DietPlanFoodItem[] {
  const foods = selectProteinFoods(dietaryPreference).slice(0, PLAN_SHARES.length);
  return foods.map((item, i) => {
    const share = PLAN_SHARES[i] ?? 0.1;
    const targetGrams = proteinTargetGrams * share;
    if (item.proteinPerUnit !== null) {
      const units = Math.max(0.5, Math.round((targetGrams / item.proteinPerUnit) * 2) / 2);
      return {
        food: item.food,
        portion: `${units} ${item.unitLabel}${units === 1 ? "" : "s"}`,
        proteinGrams: Math.round(units * item.proteinPerUnit),
        note: item.note,
      };
    }
    const per100 = item.proteinPer100g as number;
    const grams = round5((targetGrams / per100) * 100);
    return {
      food: item.food,
      portion: `${grams} ${item.unitLabel}`,
      proteinGrams: Math.round((grams * per100) / 100),
      note: item.note,
    };
  });
}

// --- Main entry ----------------------------------------------------------------

export function calculateDietPlan(input: DietPlanInput): DietPlanResult {
  const bmi = calculateBMI(input.weightKg, input.heightCm);
  const bmrCalories = calculateBMR(input.weightKg, input.heightCm, input.age, input.sex);
  const dailyCalories = Math.round(bmrCalories * ACTIVITY_FACTOR[input.activityLevel]);
  const band = PROTEIN_PER_KG[input.activityLevel];
  const protein = {
    min: Math.round(input.weightKg * band.min),
    max: Math.round(input.weightKg * band.max),
    estimate: Math.round(input.weightKg * band.estimate),
  };
  return {
    bmi,
    bmiCategory: getBmiCategory(bmi),
    bmrCalories,
    dailyCalories,
    protein,
    foodPlan: buildFoodPlan(protein.estimate, input.dietaryPreference),
    disclaimer: DIET_PLAN_DISCLAIMER,
  };
}

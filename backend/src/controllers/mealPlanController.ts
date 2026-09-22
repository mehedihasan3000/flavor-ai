import type { Request, Response } from "express";
import type { FilterQuery } from "mongoose";
import { MealPlanModel } from "../models/MealPlan.js";
import { RecipeModel } from "../models/Recipe.js";
import {
  generateMealPlan,
  optimizePlan as optimizePlanService,
  swapMeal as swapMealService,
} from "../services/mealPlanService.js";
import {
  AIGenerateMealPlanInput,
  CreateMealPlanInput,
  SwapMealInput,
  UpdateMealPlanInput,
  type MealPlanListQuery,
} from "../types/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseIdParam } from "../utils/params.js";
import { sanitizePlainText } from "../utils/sanitize.js";

/**
 * Meal-plan controller — owned by Dev B (Workstream B, FEATURES_TASKS.md §B2).
 *
 * Draft endpoint docs (§9B; Lead moves to `docs/API_CONTRACT.md`):
 * - `GET /meal-plans?status=&isFavorite=` → 200 paginated
 *   `{ items, page, limit, total, totalPages }` (all `requireAuth`).
 * - `POST /meal-plans` → 201 `{ plan }`; `recipeId`s must exist and be
 *   `published` (else 404); out-of-range meal date / duplicate slot → 400.
 * - `GET /meal-plans/:id` → 200 `{ plan }` with populated recipe cards;
 *   deleted recipe → meal shows `recipe: null` + `missing: true`, never 500.
 * - `PATCH /meal-plans/:id` → 200 `{ plan }` (deterministic, no AI call).
 * - `DELETE /meal-plans/:id` → 200 `{ success: true }`.
 * All `:id` params validated (400 on malformed); all queries user-scoped
 * (`req.user.id`, never a client `userId`); cross-user (incl. admin) → 404.
 */

type MealSubdoc = {
  _id: unknown;
  date: Date | string;
  mealType: string;
  recipeId: unknown;
  servings: number;
  source: string;
  notes?: string | null;
};

type MealPlanRecord = {
  _id: unknown;
  userId: unknown;
  name: string;
  weekStartDate: Date | string;
  weekEndDate: Date | string;
  status: string;
  isFavorite: boolean;
  constraints?: Record<string, unknown> | null;
  meals: MealSubdoc[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type RecipeCardDoc = {
  _id: unknown;
  title: string;
  imageUrl?: string | null;
  servings: number;
  ingredients: Array<{
    name: string;
    quantity?: number | null;
    unit?: string | null;
    notes?: string | null;
  }>;
  nutrition?: Record<string, number | null> | null;
  dietaryLabels: string[];
  allergenWarnings: string[];
  totalTimeMinutes: number;
  cuisine?: string | null;
  category?: string | null;
  status: string;
};

function currentUser(req: Request): { id: string } {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
  }
  return req.user;
}

/**
 * Strips markup from free-text fields before schema validation (§0.3.9,
 * same as comment bodies). Non-string/missing fields pass through so Zod
 * reports the expected type errors instead of this sanitizer masking them.
 * Covers both manual CRUD bodies and the AI-generate body (B3).
 */
function sanitizePlanFields(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const out = { ...(raw as Record<string, unknown>) };
  if (typeof out.name === "string") out.name = sanitizePlainText(out.name);
  if (typeof out.notes === "string") out.notes = sanitizePlainText(out.notes);
  if (typeof out.cuisine === "string") out.cuisine = sanitizePlainText(out.cuisine);
  if (Array.isArray(out.avoidIngredients)) {
    out.avoidIngredients = out.avoidIngredients.map((item) =>
      typeof item === "string" ? sanitizePlainText(item) : item,
    );
  }
  if (typeof out.constraints === "object" && out.constraints !== null) {
    const constraints = { ...(out.constraints as Record<string, unknown>) };
    if (typeof constraints.notes === "string") {
      constraints.notes = sanitizePlainText(constraints.notes);
    }
    if (typeof constraints.cuisine === "string") {
      constraints.cuisine = sanitizePlainText(constraints.cuisine);
    }
    out.constraints = constraints;
  }
  if (Array.isArray(out.meals)) {
    out.meals = out.meals.map((meal) => {
      if (typeof meal !== "object" || meal === null) return meal;
      const copy = { ...(meal as Record<string, unknown>) };
      if (typeof copy.notes === "string") copy.notes = sanitizePlainText(copy.notes);
      return copy;
    });
  }
  return out;
}

function toISO(value: Date | string | undefined | null): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

/** `YYYY-MM-DD` (UTC) — the plan's canonical date key for grid grouping. */
function toYMD(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function toMealRecipeCard(doc: RecipeCardDoc) {
  return {
    id: String(doc._id),
    title: doc.title,
    imageUrl: doc.imageUrl ?? null,
    servings: doc.servings,
    ingredients: doc.ingredients ?? [],
    nutrition: doc.nutrition ?? null,
    dietaryLabels: doc.dietaryLabels ?? [],
    allergenWarnings: doc.allergenWarnings ?? [],
    totalTimeMinutes: doc.totalTimeMinutes,
    cuisine: doc.cuisine ?? null,
    category: doc.category ?? null,
    status: doc.status,
  };
}

/**
 * Serializes a plan. `recipeMap` hydrates meals in one lookup (single-query
 * load per §0.3.10 — never `for (id) findById`). A meal whose recipe was
 * deleted resolves to `recipe: null` + `missing: true`, never a 500.
 */
function toMealPlanResponse(
  record: MealPlanRecord,
  recipeMap: Map<string, RecipeCardDoc> = new Map(),
) {
  return {
    id: String(record._id),
    userId: String(record.userId),
    name: record.name,
    weekStartDate: toYMD(record.weekStartDate),
    weekEndDate: toYMD(record.weekEndDate),
    status: record.status,
    isFavorite: record.isFavorite,
    constraints: record.constraints ?? null,
    meals: record.meals.map((meal) => {
      const recipeId = String(meal.recipeId);
      const recipe = recipeMap.get(recipeId) ?? null;
      return {
        mealId: String(meal._id),
        date: toYMD(meal.date),
        mealType: meal.mealType,
        recipeId,
        servings: meal.servings,
        source: meal.source,
        notes: meal.notes ?? "",
        recipe: recipe ? toMealRecipeCard(recipe) : null,
        missing: recipe === null,
      };
    }),
    createdAt: toISO(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toISO(record.updatedAt) ?? new Date().toISOString(),
  };
}

/**
 * Single-query recipe load for a plan's meals. Returns docs keyed by id
 * string; absent ids simply have no entry (caller marks `missing: true`).
 */
async function loadRecipeMap(recipeIds: string[]): Promise<Map<string, RecipeCardDoc>> {
  const unique = [...new Set(recipeIds)];
  if (unique.length === 0) return new Map();
  const docs = (await RecipeModel.find({ _id: { $in: unique } })
    .lean()
    .exec()) as unknown as RecipeCardDoc[];
  const map = new Map<string, RecipeCardDoc>();
  for (const doc of docs) map.set(String(doc._id), doc);
  return map;
}

/**
 * Rejects `recipeId`s that do not exist or are not `published`
 * (same semantics as `requirePublishedRecipe`, batched into one query).
 */
async function assertRecipesPublished(recipeIds: string[]): Promise<RecipeCardDoc[]> {
  const unique = [...new Set(recipeIds)];
  if (unique.length === 0) return [];
  const docs = (await RecipeModel.find({ _id: { $in: unique }, status: "published" })
    .lean()
    .exec()) as unknown as RecipeCardDoc[];
  if (docs.length !== unique.length) {
    throw new ApiError(404, "NOT_FOUND", "Recipe not found.");
  }
  return docs;
}

/**
 * GET /meal-plans — own plans, newest first, paginated.
 * Filters: `status` exact; `isFavorite=true` for the Favorites tab.
 */
export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const query = req.query as unknown as MealPlanListQuery;

  const filter: FilterQuery<MealPlanRecord> = { userId: user.id };
  if (query.status) filter.status = query.status;
  if (query.isFavorite === true) filter.isFavorite = true;

  const [docs, total] = await Promise.all([
    MealPlanModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean()
      .exec(),
    MealPlanModel.countDocuments(filter),
  ]);

  // Hydrate list meals in one query so `missing` means "recipe deleted",
  // never "list items are not hydrated".
  const records = docs as unknown as MealPlanRecord[];
  const recipeMap = await loadRecipeMap(
    records.flatMap((doc) => doc.meals.map((meal) => String(meal.recipeId))),
  );

  res.json({
    items: records.map((doc) => toMealPlanResponse(doc, recipeMap)),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  });
});

/**
 * POST /meal-plans — manual create. Meals may be empty (AI flow creates the
 * shell first). Every `recipeId` must be an existing published recipe.
 */
export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const input = CreateMealPlanInput.parse(sanitizePlanFields(req.body));

  const recipeDocs = await assertRecipesPublished(input.meals.map((meal) => meal.recipeId));
  const recipeMap = new Map(recipeDocs.map((doc) => [String(doc._id), doc]));

  const created = await MealPlanModel.create({
    userId: user.id,
    name: input.name ?? "My Week",
    weekStartDate: new Date(`${input.weekStartDate}T00:00:00.000Z`),
    weekEndDate: new Date(`${input.weekEndDate}T00:00:00.000Z`),
    status: input.status,
    isFavorite: input.isFavorite,
    constraints: input.constraints ?? null,
    meals: input.meals.map((meal) => ({
      date: new Date(`${meal.date}T00:00:00.000Z`),
      mealType: meal.mealType,
      recipeId: meal.recipeId,
      servings: meal.servings,
      source: meal.source,
      notes: meal.notes ?? "",
    })),
  });

  res.status(201).json({
    plan: toMealPlanResponse(
      { ...created.toObject(), _id: created._id } as unknown as MealPlanRecord,
      recipeMap,
    ),
  });
});

/**
 * GET /meal-plans/:id — own plan detail with populated recipe cards
 * (cross-user, incl. admin → 404).
 */
export const getPlan = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const id = parseIdParam(req.params.id, "id");

  const record = (await MealPlanModel.findOne({ _id: id, userId: user.id })
    .lean()
    .exec()) as unknown as MealPlanRecord | null;
  if (!record) {
    throw new ApiError(404, "NOT_FOUND", "Meal plan not found.");
  }

  const recipeMap = await loadRecipeMap(record.meals.map((meal) => String(meal.recipeId)));
  res.json({ plan: toMealPlanResponse(record, recipeMap) });
});

/**
 * Validates a merged week (stored values + incoming patch) that Zod alone
 * cannot see: a date-only patch can push existing meals out of range, and a
 * meals-only patch is checked against the stored range. Throws 400 envelopes.
 */
function assertMergedWeekValid(args: {
  weekStartDate: Date | string;
  weekEndDate: Date | string;
  meals: Array<{ date: Date | string; mealType: string }>;
}): void {
  const start = new Date(args.weekStartDate).getTime();
  const end = new Date(args.weekEndDate).getTime();
  if (end <= start) {
    throw new ApiError(400, "VALIDATION_ERROR", "weekEndDate must be after weekStartDate.");
  }
  const seen = new Set<string>();
  args.meals.forEach((meal, index) => {
    const time = new Date(meal.date).getTime();
    if (time < start || time > end) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        `Meal at index ${index} falls outside the plan week.`,
      );
    }
    const slot = `${new Date(meal.date).toISOString()}|${meal.mealType}`;
    if (seen.has(slot)) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Duplicate meal slot: only one meal per date and meal type is allowed.",
      );
    }
    seen.add(slot);
  });
}

/**
 * PATCH /meal-plans/:id — deterministic edit (no AI call). Scalar fields
 * patch individually; `meals` replaces the whole array (move = change
 * `date`/`mealType`, remove = omit, servings stored only). `isFavorite`
 * toggles the flag without touching `status`. Merged week re-validated
 * (range + slot uniqueness); new `recipeId`s must be published (404).
 * Cross-user (incl. admin) → 404.
 */
export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const id = parseIdParam(req.params.id, "id");
  const input = UpdateMealPlanInput.parse(sanitizePlanFields(req.body));

  const record = await MealPlanModel.findOne({ _id: id, userId: user.id }).exec();
  if (!record) {
    throw new ApiError(404, "NOT_FOUND", "Meal plan not found.");
  }

  if (input.meals !== undefined) {
    await assertRecipesPublished(input.meals.map((meal) => meal.recipeId));
  }

  const mergedWeek = {
    weekStartDate:
      input.weekStartDate !== undefined
        ? new Date(`${input.weekStartDate}T00:00:00.000Z`)
        : record.weekStartDate,
    weekEndDate:
      input.weekEndDate !== undefined
        ? new Date(`${input.weekEndDate}T00:00:00.000Z`)
        : record.weekEndDate,
    meals:
      input.meals !== undefined
        ? input.meals.map((meal) => ({
            date: new Date(`${meal.date}T00:00:00.000Z`),
            mealType: meal.mealType,
          }))
        : record.meals.map((meal: { date: Date | string; mealType: string }) => ({
            date: meal.date,
            mealType: meal.mealType,
          })),
  };
  assertMergedWeekValid(mergedWeek);

  if (input.name !== undefined) record.name = input.name;
  if (input.weekStartDate !== undefined) {
    record.weekStartDate = new Date(`${input.weekStartDate}T00:00:00.000Z`);
  }
  if (input.weekEndDate !== undefined) {
    record.weekEndDate = new Date(`${input.weekEndDate}T00:00:00.000Z`);
  }
  if (input.status !== undefined) record.status = input.status;
  if (input.isFavorite !== undefined) record.isFavorite = input.isFavorite;
  if (input.constraints !== undefined) record.constraints = input.constraints ?? null;
  if (input.meals !== undefined) {
    // Preserve stored `source` when the client omits it on the same slot;
    // brand-new slots default to `"manual"`.
    const storedSourceBySlot = new Map<string, string>();
    for (const stored of record.meals as unknown as MealSubdoc[]) {
      storedSourceBySlot.set(`${toYMD(stored.date)}|${stored.mealType}`, stored.source);
    }
    record.meals = input.meals.map((meal) => ({
      date: new Date(`${meal.date}T00:00:00.000Z`),
      mealType: meal.mealType,
      recipeId: meal.recipeId,
      servings: meal.servings,
      source: meal.source ?? storedSourceBySlot.get(`${meal.date}|${meal.mealType}`) ?? "manual",
      notes: meal.notes ?? "",
    })) as unknown as typeof record.meals;
  }
  await record.save();

  const recipeMap = await loadRecipeMap(
    record.meals.map((meal: { recipeId: unknown }) => String(meal.recipeId)),
  );
  res.json({
    plan: toMealPlanResponse(
      { ...record.toObject(), _id: record._id } as unknown as MealPlanRecord,
      recipeMap,
    ),
  });
});

/** DELETE /meal-plans/:id — delete own plan (cross-user, incl. admin → 404). */
export const deletePlan = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const id = parseIdParam(req.params.id, "id");

  const deleted = await MealPlanModel.findOneAndDelete({ _id: id, userId: user.id }).exec();
  if (!deleted) {
    throw new ApiError(404, "NOT_FOUND", "Meal plan not found.");
  }
  res.status(200).json({ success: true });
});

/**
 * POST /meal-plans/ai-generate — AI full-plan generation (body = constraints).
 * Failures are retryable 502/504 envelopes; invalid AI output is never stored.
 */
export const aiGeneratePlan = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const input = AIGenerateMealPlanInput.parse(sanitizePlanFields(req.body));

  const created = await generateMealPlan(input, user.id);
  const recipeMap = await loadRecipeMap(
    created.meals.map((meal: { recipeId: unknown }) => String(meal.recipeId)),
  );
  res.status(201).json({
    plan: toMealPlanResponse(
      { ...created.toObject(), _id: created._id } as unknown as MealPlanRecord,
      recipeMap,
    ),
  });
});

/**
 * POST /meal-plans/:id/swap-meal — replace ONE meal (body `{ mealId }`).
 * Everything else stays byte-identical.
 */
export const swapPlanMeal = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const id = parseIdParam(req.params.id, "id");
  const input = SwapMealInput.parse(sanitizePlanFields(req.body));

  const plan = await swapMealService(id, input, user.id);
  const recipeMap = await loadRecipeMap(
    plan.meals.map((meal: { recipeId: unknown }) => String(meal.recipeId)),
  );
  res.json({
    plan: toMealPlanResponse(
      { ...plan.toObject(), _id: plan._id } as unknown as MealPlanRecord,
      recipeMap,
    ),
  });
});

/**
 * POST /meal-plans/:id/optimize — pantry/reuse/nutrition optimization pass.
 * Deterministic scoring first, AI re-orders/swaps within constraints.
 */
export const optimizePlan = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const id = parseIdParam(req.params.id, "id");

  const plan = await optimizePlanService(id, user.id);
  const recipeMap = await loadRecipeMap(
    plan.meals.map((meal: { recipeId: unknown }) => String(meal.recipeId)),
  );
  res.json({
    plan: toMealPlanResponse(
      { ...plan.toObject(), _id: plan._id } as unknown as MealPlanRecord,
      recipeMap,
    ),
  });
});

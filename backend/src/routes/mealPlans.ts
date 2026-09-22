import { Router } from "express";
import {
  aiGeneratePlan,
  createPlan,
  deletePlan,
  getPlan,
  listPlans,
  optimizePlan,
  swapPlanMeal,
  updatePlan,
} from "../controllers/mealPlanController.js";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimiter } from "../middleware/rateLimiters.js";
import { validateQuery } from "../middleware/validate.js";
import { MealPlanListQuery } from "../types/index.js";

/**
 * Meal-plan routes — owned by Dev B (Workstream B, FEATURES_TASKS.md §1.2, §B2–B3).
 * Every route requires auth; queries validated by Zod via `validateQuery`.
 * Bodies are validated in-controller AFTER `sanitizePlanFields` strips markup
 * (sanitize-then-validate, so length checks run on the stored value — no
 * `validateBody` here, unlike pantry/comments which pre-validate raw input).
 * `:id` params are validated in-controller via `parseIdParam` (400 on
 * malformed — same as comments/favorites/admin; there is no `validateParams`
 * middleware in the codebase).
 * AI routes carry `aiRateLimiter` (10/15min, same as `/ai/*`); the expensive
 * deterministic routes stay on the base limiter in v1 (§0.3.5).
 *
 * Mounted by the Lead in `v1.ts` (shared file — do NOT mount here).
 */
export const mealPlansRouter = Router();

mealPlansRouter.get("/", requireAuth, validateQuery(MealPlanListQuery), listPlans);
mealPlansRouter.post("/", requireAuth, createPlan);
mealPlansRouter.get("/:id", requireAuth, getPlan);
mealPlansRouter.patch("/:id", requireAuth, updatePlan);
mealPlansRouter.delete("/:id", requireAuth, deletePlan);

mealPlansRouter.post("/ai-generate", requireAuth, aiRateLimiter, aiGeneratePlan);
mealPlansRouter.post("/:id/swap-meal", requireAuth, aiRateLimiter, swapPlanMeal);
mealPlansRouter.post("/:id/optimize", requireAuth, aiRateLimiter, optimizePlan);

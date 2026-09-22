import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MealPlanModel } from "../src/models/MealPlan.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { AIGenerateMealPlanInput } from "../src/types/index.js";
import {
  generateMealPlan,
  optimizePlan,
  swapMeal,
} from "../src/services/mealPlanService.js";
import { ApiError } from "../src/utils/ApiError.js";

/**
 * Meal-plan AI tests (FEATURES_TASKS.md §B5, Dev B).
 * Groq `fetch` is mocked — no network, no key needed beyond the test `.env`.
 * Verifies: happy-path stores a valid plan, hallucinated recipeIds are
 * discarded, invalid JSON → 502 with nothing stored, swap touches exactly
 * one meal, optimize marks changed meals, timeout → 504.
 */

let mongo: MongoMemoryServer;
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await MealPlanModel.syncIndexes();
  await RecipeModel.init();
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([MealPlanModel.deleteMany({}), RecipeModel.deleteMany({})]);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

let recipeCounter = 0;
async function seedRecipe(): Promise<string> {
  recipeCounter += 1;
  const recipe = await RecipeModel.create({
    owner: new mongoose.Types.ObjectId(),
    source: "manual",
    title: `AI Plan Recipe ${recipeCounter}`,
    slug: `ai-plan-recipe-${recipeCounter}-${Date.now()}`,
    ingredients: [{ name: "Rice", quantity: 200, unit: "g" }],
    steps: [{ stepNumber: 1, instruction: "Cook it." }],
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 2,
    difficulty: "easy",
    status: "published",
    publishedAt: new Date(),
  });
  return String(recipe._id);
}

function mockGroq(content: string) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as Response);
}

function userId(): string {
  return new mongoose.Types.ObjectId().toString();
}

const BASE_INPUT = {
  weekStartDate: "2026-09-21",
  days: 1,
  mealsPerDay: ["dinner"],
  servings: 2,
} as const;

describe("mealPlanService AI (FEATURES_TASKS.md §B5)", () => {
  it("happy-path stores a valid plan with a constraints snapshot", async () => {
    const recipeId = await seedRecipe();
    mockGroq(
      JSON.stringify({
        meals: [{ date: "2026-09-21", mealType: "dinner", recipeId, servings: 2 }],
      }),
    );

    const plan = await generateMealPlan(
      AIGenerateMealPlanInput.parse({ ...BASE_INPUT }),
      userId(),
    );

    expect(plan.meals).toHaveLength(1);
    expect(String(plan.meals[0].recipeId)).toBe(recipeId);
    expect(plan.meals[0].source).toBe("ai");
    expect(plan.constraints?.days).toBe(1);
    expect(await MealPlanModel.countDocuments()).toBe(1);
  });

  it("discards hallucinated recipeIds and out-of-slot meals", async () => {
    const recipeId = await seedRecipe();
    const hallucinated = new mongoose.Types.ObjectId().toString();
    mockGroq(
      JSON.stringify({
        meals: [
          { date: "2026-09-21", mealType: "dinner", recipeId, servings: 2 },
          { date: "2026-09-21", mealType: "dinner", recipeId: hallucinated, servings: 2 },
          { date: "2026-12-25", mealType: "lunch", recipeId, servings: 2 },
        ],
      }),
    );

    const plan = await generateMealPlan(
      AIGenerateMealPlanInput.parse({ ...BASE_INPUT }),
      userId(),
    );

    expect(plan.meals).toHaveLength(1);
    expect(String(plan.meals[0].recipeId)).toBe(recipeId);
  });

  it("invalid JSON → 502 and nothing is stored", async () => {
    await seedRecipe();
    mockGroq("definitely not json {{{");

    await expect(
      generateMealPlan(AIGenerateMealPlanInput.parse({ ...BASE_INPUT }), userId()),
    ).rejects.toMatchObject({ status: 502, code: "AI_PROVIDER_ERROR" });
    expect(await MealPlanModel.countDocuments()).toBe(0);
  });

  it("swap changes exactly one meal, keeping the rest byte-identical", async () => {
    const lunchId = await seedRecipe();
    const dinnerId = await seedRecipe();
    const replacementId = await seedRecipe();
    const uid = userId();
    mockGroq(
      JSON.stringify({
        meals: [
          { date: "2026-09-21", mealType: "lunch", recipeId: lunchId, servings: 2 },
          { date: "2026-09-21", mealType: "dinner", recipeId: dinnerId, servings: 2 },
        ],
      }),
    );
    const plan = await generateMealPlan(
      AIGenerateMealPlanInput.parse({
        ...BASE_INPUT,
        mealsPerDay: ["lunch", "dinner"],
      }),
      uid,
    );
    const dinnerMealId = String(plan.meals.find((m) => m.mealType === "dinner")!._id);
    const lunchBefore = JSON.stringify({
      recipeId: String(plan.meals.find((m) => m.mealType === "lunch")!.recipeId),
      servings: plan.meals.find((m) => m.mealType === "lunch")!.servings,
    });

    mockGroq(
      JSON.stringify({
        meals: [{ date: "2026-09-21", mealType: "dinner", recipeId: replacementId, servings: 2 }],
      }),
    );
    const updated = await swapMeal(String(plan._id), { mealId: dinnerMealId }, uid);

    expect(updated.meals).toHaveLength(2);
    const lunchAfter = updated.meals.find((m) => m.mealType === "lunch")!;
    expect(
      JSON.stringify({ recipeId: String(lunchAfter.recipeId), servings: lunchAfter.servings }),
    ).toBe(lunchBefore);
    const dinnerAfter = updated.meals.find((m) => m.mealType === "dinner")!;
    expect(String(dinnerAfter.recipeId)).toBe(replacementId);
    expect(dinnerAfter.source).toBe("swap");
    expect(dinnerAfter.servings).toBe(2);
  });

  it("optimize keeps valid slots and marks changed meals as optimized", async () => {
    const lunchId = await seedRecipe();
    const dinnerId = await seedRecipe();
    const replacementId = await seedRecipe();
    const uid = userId();
    mockGroq(
      JSON.stringify({
        meals: [
          { date: "2026-09-21", mealType: "lunch", recipeId: lunchId, servings: 2 },
          { date: "2026-09-21", mealType: "dinner", recipeId: dinnerId, servings: 2 },
        ],
      }),
    );
    const plan = await generateMealPlan(
      AIGenerateMealPlanInput.parse({
        ...BASE_INPUT,
        mealsPerDay: ["lunch", "dinner"],
      }),
      uid,
    );

    mockGroq(
      JSON.stringify({
        meals: [
          { date: "2026-09-21", mealType: "lunch", recipeId: lunchId, servings: 2 },
          { date: "2026-09-21", mealType: "dinner", recipeId: replacementId, servings: 2 },
        ],
      }),
    );
    const updated = await optimizePlan(String(plan._id), uid);

    expect(updated.meals).toHaveLength(2);
    expect(updated.meals.find((m) => m.mealType === "lunch")!.source).toBe("ai");
    const dinner = updated.meals.find((m) => m.mealType === "dinner")!;
    expect(String(dinner.recipeId)).toBe(replacementId);
    expect(dinner.source).toBe("optimized");
  });

  it("provider timeout → 504", async () => {
    await seedRecipe();
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));

    try {
      await generateMealPlan(AIGenerateMealPlanInput.parse({ ...BASE_INPUT }), userId());
      expect.unreachable("expected a 504 timeout");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(504);
    }
    expect(await MealPlanModel.countDocuments()).toBe(0);
  });
});

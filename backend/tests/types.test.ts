import { describe, expect, it } from "vitest";
import {
  AIRecipeOutputSchema,
  CreateCommentInput,
  CreateRatingInput,
  CreateRecipeInput,
  PaginationQuery,
  ErrorEnvelope,
} from "../src/types/index.js";

describe("contract: AIRecipeOutputSchema", () => {
  it("accepts a complete valid AI recipe", () => {
    const result = AIRecipeOutputSchema.safeParse({
      title: "Garlic Spinach Chicken",
      summary: "Quick weeknight dinner",
      ingredients: [
        { name: "chicken breast", quantity: 2, unit: "pieces", pantryMatch: "used" },
        { name: "olive oil", quantity: 1, unit: "tbsp", pantryMatch: "missing" },
      ],
      steps: [
        { stepNumber: 1, instruction: "Season and pan-sear the chicken." },
        { stepNumber: 2, instruction: "Add garlic and spinach, wilt and serve." },
      ],
      prepTimeMinutes: 10,
      cookTimeMinutes: 20,
      servings: 2,
      difficulty: "easy",
      cuisine: "mediterranean",
      category: "main-course",
      tags: ["quick"],
      dietaryLabels: ["high-protein", "gluten-free"],
      allergenWarnings: ["none"],
      nutrition: {
        caloriesPerServing: 420,
        proteinGramsPerServing: 40,
        carbsGramsPerServing: 12,
        fatGramsPerServing: 22,
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid/incomplete output (FR-AI-07)", () => {
    const result = AIRecipeOutputSchema.safeParse({
      title: "X",
      ingredients: [],
      steps: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range difficulty", () => {
    const result = AIRecipeOutputSchema.safeParse({
      title: "Valid Title Here",
      summary: "s",
      ingredients: [{ name: "eggs" }],
      steps: [{ stepNumber: 1, instruction: "Cook." }],
      prepTimeMinutes: 0,
      cookTimeMinutes: 5,
      servings: 1,
      difficulty: "impossible",
    });
    expect(result.success).toBe(false);
  });
});

describe("contract: ratings", () => {
  it("accepts 1..5 only", () => {
    expect(CreateRatingInput.safeParse({ value: 5 }).success).toBe(true);
    expect(CreateRatingInput.safeParse({ value: 6 }).success).toBe(false);
    expect(CreateRatingInput.safeParse({ value: 0 }).success).toBe(false);
  });
});

describe("contract: comments", () => {
  it("rejects empty comments (FR-COMMENT-04)", () => {
    expect(CreateCommentInput.safeParse({ body: "" }).success).toBe(false);
    expect(CreateCommentInput.safeParse({ body: "   " }).success).toBe(false);
  });
});

describe("contract: manual recipe input", () => {
  it("rejects a recipe without ingredients", () => {
    const result = CreateRecipeInput.safeParse({
      title: "No Ingredient Recipe",
      slug: "no-ingredient-recipe",
      ingredients: [],
      steps: [{ stepNumber: 1, instruction: "Do nothing." }],
      prepTimeMinutes: 0,
      cookTimeMinutes: 0,
      servings: 1,
      difficulty: "easy",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a bad slug", () => {
    const result = CreateRecipeInput.safeParse({
      title: "Bad Slug",
      slug: "Bad Slug!",
      ingredients: [{ name: "eggs" }],
      steps: [{ stepNumber: 1, instruction: "Cook." }],
      prepTimeMinutes: 0,
      cookTimeMinutes: 5,
      servings: 1,
      difficulty: "easy",
    });
    expect(result.success).toBe(false);
  });
});

describe("contract: pagination + error envelope", () => {
  it("coerces string pagination values", () => {
    const parsed = PaginationQuery.parse({ page: "2", limit: "50" });
    expect(parsed).toEqual({ page: 2, limit: 50 });
  });

  it("rejects limit over 100", () => {
    expect(PaginationQuery.safeParse({ limit: "500" }).success).toBe(false);
    expect(PaginationQuery.safeParse({ limit: "50" }).success).toBe(true);
  });

  it("error envelope requires the standard shape", () => {
    expect(
      ErrorEnvelope.safeParse({
        status: 400,
        code: "VALIDATION_ERROR",
        safeMessage: "Invalid input data.",
        validation: { title: "Too short" },
      }).success,
    ).toBe(true);
  });
});
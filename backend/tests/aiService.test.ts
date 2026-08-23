import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildFlavorPairingPrompt,
  buildRecipePrompt,
  generateAIRecipe,
  generateFlavorPairings,
  matchPantry,
} from "../src/services/aiService.js";
import type {
  AIRecipePromptInput,
  FlavorPairingInput,
  RecipeIngredient,
} from "../src/types/index.js";
import { ApiError } from "../src/utils/ApiError.js";

describe("aiService — Pantry Matching", () => {
  it("correctly identifies used vs missing ingredients and sets pantryMatch properties", () => {
    const inputIngredients = ["Chicken Breast", "Garlic", "Olive Oil"];
    const recipeIngredients: RecipeIngredient[] = [
      { name: "chicken breast", quantity: 2, unit: "pieces" },
      { name: "garlic cloves", quantity: 3 },
      { name: "fresh spinach", quantity: 100, unit: "g" },
      { name: "salt", quantity: 1, unit: "tsp" },
    ];

    const result = matchPantry(inputIngredients, recipeIngredients);

    expect(result.usedIngredients).toContain("chicken breast");
    expect(result.usedIngredients).toContain("garlic cloves");
    expect(result.missingIngredients).toContain("fresh spinach");
    expect(result.missingIngredients).toContain("salt");
    expect(result.usageCount).toBe(2);
    expect(result.missingCount).toBe(2);

    expect(recipeIngredients[0].pantryMatch).toBe("used");
    expect(recipeIngredients[1].pantryMatch).toBe("used");
    expect(recipeIngredients[2].pantryMatch).toBe("missing");
    expect(recipeIngredients[3].pantryMatch).toBe("missing");
  });
});

describe("aiService — Prompt Builders", () => {
  it("builds a recipe prompt incorporating ingredients, preferences, and exclusions", () => {
    const input: AIRecipePromptInput = {
      ingredients: ["chicken breast", { name: "garlic", quantity: 2, unit: "cloves" }],
      mealType: "dinner",
      cuisine: "mediterranean",
      servings: 4,
      maxCookingTimeMinutes: 30,
      difficulty: "easy",
      availableEquipment: ["oven", "skillet"],
      excludedIngredients: ["mushrooms"],
      preferences: {
        dietaryLabels: ["gluten-free"],
        allergies: ["peanuts"],
        dislikedIngredients: ["cilantro"],
      },
    };

    const { systemPrompt, userPrompt } = buildRecipePrompt(input);

    expect(systemPrompt).toContain("FlavorAI");
    expect(userPrompt).toContain("chicken breast");
    expect(userPrompt).toContain("2 cloves garlic");
    expect(userPrompt).toContain("dinner");
    expect(userPrompt).toContain("mediterranean");
    expect(userPrompt).toContain("30 minutes");
    expect(userPrompt).toContain("easy");
    expect(userPrompt).toContain("oven, skillet");
    expect(userPrompt).toContain("mushrooms");
    expect(userPrompt).toContain("gluten-free");
    expect(userPrompt).toContain("peanuts");
    expect(userPrompt).toContain("cilantro");
  });

  it("builds a flavor pairing prompt", () => {
    const input: FlavorPairingInput = {
      ingredient: "salmon",
      preferences: {
        dietaryLabels: ["keto"],
        allergies: ["dairy"],
        dislikedIngredients: []
      },
    };

    const { systemPrompt, userPrompt } = buildFlavorPairingPrompt(input);

    expect(systemPrompt).toContain("FlavorAI");
    expect(userPrompt).toContain("salmon");
    expect(userPrompt).toContain("keto");
    expect(userPrompt).toContain("dairy");
  });
});

describe("aiService — API Generators (with mock fetch)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const validAIRecipeObject = {
    title: "Garlic Butter Chicken",
    summary: "A quick garlic chicken recipe",
    ingredients: [
      { name: "chicken breast", quantity: 2, unit: "pieces" },
      { name: "garlic", quantity: 3, unit: "cloves" },
    ],
    steps: [
      { stepNumber: 1, instruction: "Sear chicken in a hot skillet." },
      { stepNumber: 2, instruction: "Add garlic and butter, baste well." },
    ],
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    servings: 2,
    difficulty: "easy",
    cuisine: "mediterranean",
    category: "main-course",
    tags: ["quick", "dinner"],
    dietaryLabels: ["gluten-free", "high-protein"],
    allergenWarnings: ["dairy"],
    nutrition: {
      caloriesPerServing: 350,
      proteinGramsPerServing: 40,
      carbsGramsPerServing: 2,
      fatGramsPerServing: 18,
    },
  };

  it("generates an AI recipe and applies pantry matching when API returns valid JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(validAIRecipeObject),
            },
          },
        ],
      }),
    } as Response);

    const input: AIRecipePromptInput = {
      ingredients: ["chicken breast"],
      servings: 2,
      availableEquipment: [],
      excludedIngredients: []
    };

    const { recipe, pantryMatch } = await generateAIRecipe(input);

    expect(recipe.title).toBe("Garlic Butter Chicken");
    expect(recipe.ingredients).toHaveLength(2);
    expect(pantryMatch.usedIngredients).toContain("chicken breast");
    expect(pantryMatch.missingIngredients).toContain("garlic");
  });

  it("throws 502 AI_PROVIDER_ERROR when API returns invalid JSON structure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: "This is not json text at all!",
            },
          },
        ],
      }),
    } as Response);

    const input: AIRecipePromptInput = {
      ingredients: ["chicken breast"],
      servings: 2,
      availableEquipment: [],
      excludedIngredients: []
    };

    await expect(generateAIRecipe(input)).rejects.toThrowError(ApiError);
    await expect(generateAIRecipe(input)).rejects.toMatchObject({
      status: 502,
      code: "AI_PROVIDER_ERROR",
    });
  });

  it("throws 502 AI_PROVIDER_ERROR when API returns JSON that fails Zod validation", async () => {
    const invalidSchemaObject = {
      title: "Short",
      // missing required steps, prepTimeMinutes, cookTimeMinutes, etc.
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(invalidSchemaObject),
            },
          },
        ],
      }),
    } as Response);

    const input: AIRecipePromptInput = {
      ingredients: ["chicken breast"],
      servings: 2,
      availableEquipment: [],
      excludedIngredients: []
    };

    await expect(generateAIRecipe(input)).rejects.toThrowError(ApiError);
    await expect(generateAIRecipe(input)).rejects.toMatchObject({
      status: 502,
      code: "AI_PROVIDER_ERROR",
    });
  });

  it("throws 504 AI_PROVIDER_ERROR on request timeout (AbortError)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue({
      name: "AbortError",
      message: "The operation was aborted",
    });

    const input: AIRecipePromptInput = {
      ingredients: ["chicken breast"],
      servings: 2,
      availableEquipment: [],
      excludedIngredients: []
    };

    await expect(generateAIRecipe(input)).rejects.toThrowError(ApiError);
    await expect(generateAIRecipe(input)).rejects.toMatchObject({
      status: 504,
      code: "AI_PROVIDER_ERROR",
    });
  });

  it("generates flavor pairings when API returns valid suggestion schema", async () => {
    const validFlavorPairings = {
      suggestions: [
        { ingredient: "lemon juice", reason: "Acidity balances rich chicken", type: "addition" },
        { ingredient: "rosemary", reason: "Aromatic herbal substitute for thyme", type: "substitution" },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(validFlavorPairings),
            },
          },
        ],
      }),
    } as Response);

    const input: FlavorPairingInput = {
      ingredient: "chicken breast",
    };

    const { suggestions } = await generateFlavorPairings(input);

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].ingredient).toBe("lemon juice");
    expect(suggestions[0].type).toBe("addition");
    expect(suggestions[1].type).toBe("substitution");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildFlavorPairingPrompt,
  buildRecipePrompt,
  matchPantry,
} from "../src/services/aiService.js";
import {
  AIRecipeOutputSchema,
  AIRecipePromptInput,
  CreateCommentInput,
  CreateRatingInput,
  CreateRecipeInput,
  DietaryPreferences,
  FlavorPairingSuggestionSchema,
  RecipeIngredient,
} from "../src/types/index.js";

describe("Section 6.2 — Backend Unit: Zod Schemas & Pantry & AI Parsing", () => {
  describe("Pantry Matching Algorithm (FR-PANTRY-01..03)", () => {
    it("matches exact, case-insensitive, and punctuation-varied ingredients", () => {
      const input = ["Chicken Breast", "olive oil", "Garlic, minced", "Salt & Pepper"];
      const recipeIngredients: RecipeIngredient[] = [
        { name: "chicken breast", quantity: 2, unit: "pieces" },
        { name: "Extra Virgin Olive Oil", quantity: 2, unit: "tbsp" },
        { name: "Garlic", quantity: 3, unit: "cloves" },
        { name: "Fresh Rosemary", quantity: 1, unit: "sprig" },
      ];

      const result = matchPantry(input, recipeIngredients);

      expect(result.usedIngredients).toContain("chicken breast");
      expect(result.usedIngredients).toContain("Extra Virgin Olive Oil");
      expect(result.usedIngredients).toContain("Garlic");
      expect(result.missingIngredients).toEqual(["Fresh Rosemary"]);
      expect(result.usageCount).toBe(3);
      expect(result.missingCount).toBe(1);

      // Verify recipe ingredient objects were tagged
      expect(recipeIngredients[0].pantryMatch).toBe("used");
      expect(recipeIngredients[1].pantryMatch).toBe("used");
      expect(recipeIngredients[2].pantryMatch).toBe("used");
      expect(recipeIngredients[3].pantryMatch).toBe("missing");
    });

    it("handles ingredient input objects with quantities and units", () => {
      const input = [
        { name: "flour", quantity: 500, unit: "grams" },
        { name: "whole milk", quantity: 1, unit: "liter" },
      ];
      const recipeIngredients: RecipeIngredient[] = [
        { name: "All-Purpose Flour", quantity: 2, unit: "cups" },
        { name: "Milk", quantity: 1, unit: "cup" },
        { name: "Eggs", quantity: 2, unit: "pieces" },
      ];

      const result = matchPantry(input, recipeIngredients);
      expect(result.usageCount).toBe(2);
      expect(result.missingCount).toBe(1);
      expect(result.missingIngredients).toContain("Eggs");
    });

    it("returns 0 usage count when pantry has no overlapping ingredients", () => {
      const input = ["tofu", "soy sauce", "sesame oil"];
      const recipeIngredients: RecipeIngredient[] = [
        { name: "Beef Sirloin", quantity: 1, unit: "lb" },
        { name: "Butter", quantity: 2, unit: "tbsp" },
      ];

      const result = matchPantry(input, recipeIngredients);
      expect(result.usageCount).toBe(0);
      expect(result.missingCount).toBe(2);
      expect(result.usedIngredients).toHaveLength(0);
      expect(result.missingIngredients).toEqual(["Beef Sirloin", "Butter"]);
    });
  });

  describe("AI Prompt Construction & Constraint Inclusion", () => {
    it("includes dietary constraints, allergies, and excluded ingredients in prompt", () => {
      const promptInput: AIRecipePromptInput = {
        ingredients: ["chickpeas", "tahini", "lemon", "garlic"],
        mealType: "lunch",
        cuisine: "Middle Eastern",
        servings: 4,
        maxCookingTimeMinutes: 20,
        difficulty: "easy",
        availableEquipment: ["Food Processor", "Blender"],
        excludedIngredients: ["cumin", "cilantro"],
        preferences: {
          dietaryLabels: ["vegan", "gluten-free"],
          allergies: ["peanuts", "sesame-free-note"],
          dislikedIngredients: ["onions"],
          calorieTarget: 400,
          proteinTargetGrams: 15,
        },
      };

      const { systemPrompt, userPrompt } = buildRecipePrompt(promptInput);

      expect(systemPrompt).toContain("Return ONLY a single valid JSON object");
      expect(systemPrompt).toContain('"title": string');
      expect(userPrompt).toContain("chickpeas, tahini, lemon, garlic");
      expect(userPrompt).toContain("Middle Eastern");
      expect(userPrompt).toContain("Servings requested: 4");
      expect(userPrompt).toContain("Maximum cooking time: 20 minutes");
      expect(userPrompt).toContain("Food Processor, Blender");
      expect(userPrompt).toContain("cumin, cilantro");
      expect(userPrompt).toContain("vegan, gluten-free");
      expect(userPrompt).toContain("peanuts");
      expect(userPrompt).toContain("~400");
      expect(userPrompt).toContain("~15g");
    });

    it("builds flavor pairing prompt with allergen exclusions", () => {
      const { systemPrompt, userPrompt } = buildFlavorPairingPrompt({
        ingredient: "dark chocolate",
        preferences: {
          dietaryLabels: ["vegan"],
          allergies: ["dairy", "tree nuts"],
        },
      });

      expect(systemPrompt).toContain("FlavorAI, a world-class culinary scientist");
      expect(userPrompt).toContain("Target ingredient: dark chocolate");
      expect(userPrompt).toContain("vegan");
      expect(userPrompt).toContain("dairy, tree nuts");
    });
  });

  describe("Zod Schema Strict Validation (AIRecipeOutputSchema & Contract Schemas)", () => {
    it("validates a compliant AI recipe output object", () => {
      const validAiRecipe = {
        title: "Mediterranean Quinoa Salad",
        summary: "A light and nutritious salad packed with crisp vegetables.",
        ingredients: [
          { name: "quinoa", quantity: 1, unit: "cup", notes: "rinsed" },
          { name: "cucumber", quantity: 1, unit: "medium", notes: "diced" },
          { name: "cherry tomatoes", quantity: 1, unit: "cup", notes: "halved" },
        ],
        steps: [
          { stepNumber: 1, instruction: "Cook quinoa in 2 cups of water for 15 minutes." },
          { stepNumber: 2, instruction: "Toss with diced vegetables and olive oil." },
        ],
        prepTimeMinutes: 10,
        cookTimeMinutes: 15,
        servings: 4,
        difficulty: "easy",
        cuisine: "Mediterranean",
        category: "salad",
        tags: ["healthy", "summer", "quick"],
        dietaryLabels: ["vegan", "gluten-free"],
        allergenWarnings: [],
        nutrition: {
          caloriesPerServing: 250,
          proteinGramsPerServing: 8,
          carbsGramsPerServing: 35,
          fatGramsPerServing: 9,
          fiberGramsPerServing: 5,
          sugarGramsPerServing: 3,
          sodiumMgPerServing: 120,
        },
      };

      const parsed = AIRecipeOutputSchema.safeParse(validAiRecipe);
      expect(parsed.success).toBe(true);
    });

    it("rejects AI recipe output missing mandatory fields or violating constraints", () => {
      // 1. Missing title
      const noTitle = {
        summary: "No title recipe",
        ingredients: [{ name: "egg" }],
        steps: [{ stepNumber: 1, instruction: "Fry egg." }],
        prepTimeMinutes: 2,
        cookTimeMinutes: 3,
        servings: 1,
        difficulty: "easy",
      };
      expect(AIRecipeOutputSchema.safeParse(noTitle).success).toBe(false);

      // 2. Empty ingredients
      const emptyIng = {
        title: "Empty Ingredients",
        summary: "Summary",
        ingredients: [],
        steps: [{ stepNumber: 1, instruction: "Do nothing." }],
        prepTimeMinutes: 0,
        cookTimeMinutes: 0,
        servings: 1,
        difficulty: "easy",
      };
      expect(AIRecipeOutputSchema.safeParse(emptyIng).success).toBe(false);

      // 3. Negative prep time
      const negTime = {
        title: "Negative Time",
        summary: "Summary",
        ingredients: [{ name: "water" }],
        steps: [{ stepNumber: 1, instruction: "Boil water." }],
        prepTimeMinutes: -5,
        cookTimeMinutes: 10,
        servings: 1,
        difficulty: "easy",
      };
      expect(AIRecipeOutputSchema.safeParse(negTime).success).toBe(false);

      // 4. Invalid difficulty
      const badDiff = {
        title: "Bad Difficulty",
        summary: "Summary",
        ingredients: [{ name: "water" }],
        steps: [{ stepNumber: 1, instruction: "Boil water." }],
        prepTimeMinutes: 5,
        cookTimeMinutes: 10,
        servings: 1,
        difficulty: "impossible",
      };
      expect(AIRecipeOutputSchema.safeParse(badDiff).success).toBe(false);
    });

    it("validates FlavorPairingSuggestionSchema types and constraints", () => {
      const validAddition = {
        ingredient: "basil",
        reason: "Adds aromatic herbaceous notes to tomato dishes.",
        type: "addition",
      };
      expect(FlavorPairingSuggestionSchema.safeParse(validAddition).success).toBe(true);

      const validSub = {
        ingredient: "applesauce",
        reason: "Can replace butter in baking for reduced fat.",
        type: "substitution",
      };
      expect(FlavorPairingSuggestionSchema.safeParse(validSub).success).toBe(true);

      const invalidType = {
        ingredient: "basil",
        reason: "Some reason",
        type: "garnish", // not "addition" | "substitution"
      };
      expect(FlavorPairingSuggestionSchema.safeParse(invalidType).success).toBe(false);
    });

    it("validates CreateRatingInput and CreateCommentInput bounds", () => {
      expect(CreateRatingInput.safeParse({ value: 5 }).success).toBe(true);
      expect(CreateRatingInput.safeParse({ value: 0 }).success).toBe(false);
      expect(CreateRatingInput.safeParse({ value: 6 }).success).toBe(false);
      expect(CreateRatingInput.safeParse({ value: 3.5 }).success).toBe(false); // must be int

      expect(CreateCommentInput.safeParse({ body: "Valid comment text." }).success).toBe(true);
      expect(CreateCommentInput.safeParse({ body: "" }).success).toBe(false);
      expect(CreateCommentInput.safeParse({ body: "   " }).success).toBe(false);
    });

    it("validates DietaryPreferences schema with calorie ranges and dietary labels", () => {
      const prefs = {
        dietaryLabels: ["keto", "gluten-free"],
        allergies: ["shellfish"],
        dislikedIngredients: ["anchovies"],
        calorieTarget: 1800,
        calorieRange: { min: 1600, max: 2000 },
        proteinTargetGrams: 120,
        cookingTimeMaxMinutes: 45,
        difficulty: "medium",
      };
      expect(DietaryPreferences.safeParse(prefs).success).toBe(true);

      const badCalorieRange = {
        calorieRange: { min: -10, max: 2000 },
      };
      expect(DietaryPreferences.safeParse(badCalorieRange).success).toBe(false);
    });
  });
});

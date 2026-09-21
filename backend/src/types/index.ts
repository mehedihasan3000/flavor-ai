import { z } from "zod";

/**
 * FlavorAI shared contract.
 * Single source of truth for DTOs, enums, and Zod schemas used across the API.
 * DO NOT change shapes without Team Lead sign-off (contract freeze).
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const USER_ROLE = ["user", "admin"] as const;
export const DIETARY_LABEL = [
  "vegetarian",
  "vegan",
  "halal",
  "gluten-free",
  "dairy-free",
  "high-protein",
  "low-carb",
  "keto",
] as const;

export const RECIPE_STATUS = ["draft", "published", "hidden"] as const;
export const RECIPE_SOURCE = ["manual", "ai"] as const;
export const DIFFICULTY = ["easy", "medium", "hard"] as const;
export const MEAL_TYPE = ["breakfast", "lunch", "dinner", "snack", "dessert"] as const;

export const RECIPE_CATEGORY = [
  "main-course",
  "appetizer",
  "soup",
  "salad",
  "side-dish",
  "baking",
  "beverage",
] as const;

export const TASTE_PROFILE = ["spicy", "sweet", "salty", "sour", "bitter", "umami"] as const;
export const TASTE_INTENSITY = ["mild", "medium", "strong"] as const;

export const COMMENT_STATUS = ["visible", "moderated"] as const;
export const AI_GENERATION_STATUS = ["success", "failed", "timeout"] as const;
export const AI_ERROR_CATEGORY = [
  "provider_error",
  "invalid_output",
  "timeout",
  "rate_limit",
  "unknown",
] as const;

export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "AI_PROVIDER_ERROR",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const ObjectIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PaginatedResult = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  });

export const ErrorEnvelope = z.object({
  status: z.number().int().positive(),
  code: z.enum(ERROR_CODES),
  safeMessage: z.string(),
  validation: z.record(z.string(), z.string()).optional(),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;
export type PaginationQuery = z.infer<typeof PaginationQuery>;

// ---------------------------------------------------------------------------
// User preferences (FR-DIET-01/02, FR-AUTH-06)
// ---------------------------------------------------------------------------

export const DietaryPreferences = z.object({
  dietaryLabels: z.array(z.enum(DIETARY_LABEL)).default([]),
  allergies: z.array(z.string()).default([]),
  dislikedIngredients: z.array(z.string()).default([]),
  calorieTarget: z.number().int().positive().optional(),
  calorieRange: z
    .object({
      min: z.number().int().nonnegative(),
      max: z.number().int().positive(),
    })
    .optional(),
  proteinTargetGrams: z.number().int().positive().optional(),
  cookingTimeMaxMinutes: z.number().int().positive().optional(),
  difficulty: z.enum(DIFFICULTY).optional(),
});

export type DietaryPreferences = z.infer<typeof DietaryPreferences>;

// ---------------------------------------------------------------------------
// AI recipe generation input (FR-AI-01/02, FR-PANTRY-01)
// ---------------------------------------------------------------------------

export const IngredientInput = z.object({
  name: z.string().min(1, "Ingredient name is required").max(100),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().max(30).optional(),
});

export type IngredientInput = z.infer<typeof IngredientInput>;

export const AIRecipePromptInput = z.object({
  ingredients: z
    .array(z.union([z.string().min(1).max(100), IngredientInput]))
    .min(1, "At least one ingredient is required"),
  mealType: z.enum(MEAL_TYPE).optional(),
  cuisine: z.string().max(50).optional(),
  servings: z.number().int().min(1).max(20).default(2),
  maxCookingTimeMinutes: z.number().int().positive().max(600).optional(),
  difficulty: z.enum(DIFFICULTY).optional(),
  availableEquipment: z.array(z.string().max(50)).default([]),
  excludedIngredients: z.array(z.string().max(100)).default([]),
  preferences: DietaryPreferences.optional(),
});

export type AIRecipePromptInput = z.infer<typeof AIRecipePromptInput>;

// ---------------------------------------------------------------------------
// AI recipe output — STRICT JSON contract for Groq (FR-AI-03/07, FR-NUTR)
// ---------------------------------------------------------------------------

export const NutritionEstimate = z.object({
  caloriesPerServing: z.number().nonnegative().nullable(),
  proteinGramsPerServing: z.number().nonnegative().nullable(),
  carbsGramsPerServing: z.number().nonnegative().nullable(),
  fatGramsPerServing: z.number().nonnegative().nullable(),
  fiberGramsPerServing: z.number().nonnegative().nullable().optional(),
  sugarGramsPerServing: z.number().nonnegative().nullable().optional(),
  sodiumMgPerServing: z.number().nonnegative().nullable().optional(),
});

export type NutritionEstimate = z.infer<typeof NutritionEstimate>;

export const AIRecipeOutputSchema = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().max(500),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        quantity: z.number().nonnegative().optional(),
        unit: z.string().max(30).optional(),
        notes: z.string().max(200).optional(),
        pantryMatch: z.enum(["used", "missing", "substitution"]).optional(),
      }),
    )
    .min(1, "Recipe must contain at least one ingredient"),
  steps: z
    .array(
      z.object({
        stepNumber: z.number().int().positive(),
        instruction: z.string().min(3).max(1000),
      }),
    )
    .min(1, "Recipe must contain at least one step")
    .max(50),
  prepTimeMinutes: z.number().int().nonnegative(),
  cookTimeMinutes: z.number().int().nonnegative(),
  servings: z.number().int().min(1).max(20),
  difficulty: z.enum(DIFFICULTY),
  cuisine: z.string().max(50).optional(),
  category: z.enum(RECIPE_CATEGORY).optional(),
  tags: z.array(z.string().max(50)).default([]),
  dietaryLabels: z.array(z.enum(DIETARY_LABEL)).default([]),
  allergenWarnings: z.array(z.string()).default([]),
  nutrition: NutritionEstimate.optional(),
});

export type AIRecipeOutput = z.infer<typeof AIRecipeOutputSchema>;

export const FlavorPairingInput = z.object({
  ingredient: z.string().min(1).max(100),
  preferences: DietaryPreferences.optional(),
});

export type FlavorPairingInput = z.infer<typeof FlavorPairingInput>;

export const FlavorPairingSuggestionSchema = z.object({
  ingredient: z.string().min(1).max(100),
  reason: z.string().min(3).max(300),
  type: z.enum(["addition", "substitution"]),
});

export type FlavorPairingSuggestion = z.infer<typeof FlavorPairingSuggestionSchema>;

// ---------------------------------------------------------------------------
// AI Taste Matcher (FR-TASTE-01..03) — Additive (post-freeze)
// ---------------------------------------------------------------------------

export const TasteMatchInput = z.object({
  tastes: z
    .array(z.enum(TASTE_PROFILE))
    .min(1, "Select at least one taste preference")
    .max(TASTE_PROFILE.length),
  intensity: z.enum(TASTE_INTENSITY).optional(),
  notes: z.string().max(300).optional(),
  limit: z.number().int().min(1).max(20).default(10),
});

export type TasteMatchInput = z.infer<typeof TasteMatchInput>;

export const TasteMatchSuggestionSchema = z.object({
  recipeId: ObjectIdString,
  score: z.number().min(0).max(100),
  matchedTastes: z.array(z.enum(TASTE_PROFILE)).default([]),
  reason: z.string().min(3).max(300),
});

export type TasteMatchSuggestion = z.infer<typeof TasteMatchSuggestionSchema>;

// ---------------------------------------------------------------------------
// Food Photo Nutrition Analysis (FR-PHOTO-01..04)
// ---------------------------------------------------------------------------

export const NutritionRange = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
  estimate: z.number().nonnegative(),
});

export type NutritionRange = z.infer<typeof NutritionRange>;

export const DetectedFoodItem = z.object({
  name: z.string().min(1).max(100),
  portion: z.string().min(1).max(100),
  confidence: z.enum(["high", "medium", "low"]).default("high"),
  calories: z.number().nonnegative(),
  proteinGrams: z.number().nonnegative(),
  carbsGrams: z.number().nonnegative(),
  fatGrams: z.number().nonnegative(),
  fiberGrams: z.number().nonnegative().optional(),
});

export type DetectedFoodItem = z.infer<typeof DetectedFoodItem>;

export const FoodPhotoAnalysisInput = z.object({
  image: z.string().min(1, "Image data or URL is required"),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  mealContext: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export type FoodPhotoAnalysisInput = z.infer<typeof FoodPhotoAnalysisInput>;

export const FoodPhotoAnalysisResult = z.object({
  dishName: z.string().min(2).max(120),
  summary: z.string().max(600).default(""),
  detectedFoods: z.array(DetectedFoodItem).min(1, "At least one food item must be detected"),
  totalNutrition: z.object({
    calories: NutritionRange,
    proteinGrams: NutritionRange,
    carbsGrams: NutritionRange,
    fatGrams: NutritionRange,
    fiberGrams: NutritionRange.optional(),
  }),
  macroDistribution: z
    .object({
      proteinPercentage: z.number().min(0).max(100),
      carbsPercentage: z.number().min(0).max(100),
      fatPercentage: z.number().min(0).max(100),
    })
    .optional()
    .default({ proteinPercentage: 0, carbsPercentage: 0, fatPercentage: 0 }),
  dietaryTags: z.array(z.enum(DIETARY_LABEL)).default([]),
  allergenWarnings: z.array(z.string()).default([]),
  healthInsights: z.array(z.string().max(250)).default([]),
  suggestedIngredientsForRecipe: z.array(z.string().max(100)).default([]),
  disclaimer: z
    .string()
    .default(
      "Nutritional values are approximate AI estimations based on visual appearance and should not be used as clinical or medical advice.",
    ),
});

export type FoodPhotoAnalysisResult = z.infer<typeof FoodPhotoAnalysisResult>;

// ---------------------------------------------------------------------------
// Personalized Diet Plan & Nutrition Requirement Calculator (INFO.md feature)
// ---------------------------------------------------------------------------

export const SEX = ["male", "female"] as const;

export const ACTIVITY_LEVEL = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very-active",
] as const;

export const BMI_CATEGORY = [
  "Underweight",
  "Normal weight",
  "Overweight",
  "Obesity",
] as const;

export const DietPlanInput = z.object({
  age: z.coerce.number().int().min(1, "Age must be at least 1").max(120, "Age must be at most 120"),
  weightKg: z.coerce.number().min(20, "Weight must be at least 20 kg").max(300, "Weight must be at most 300 kg"),
  heightCm: z.coerce.number().min(50, "Height must be at least 50 cm").max(250, "Height must be at most 250 cm"),
  sex: z.enum(SEX),
  activityLevel: z.enum(ACTIVITY_LEVEL),
  dietaryPreference: z.enum(DIETARY_LABEL).optional(),
});

export type DietPlanInput = z.infer<typeof DietPlanInput>;

export const DietPlanFoodItem = z.object({
  food: z.string().min(1).max(100),
  portion: z.string().min(1).max(100),
  proteinGrams: z.number().nonnegative(),
  note: z.string().max(200).optional(),
});

export type DietPlanFoodItem = z.infer<typeof DietPlanFoodItem>;

export const DietPlanResult = z.object({
  bmi: z.number().nonnegative(),
  bmiCategory: z.enum(BMI_CATEGORY),
  bmrCalories: z.number().int().nonnegative(),
  dailyCalories: z.number().int().nonnegative(),
  protein: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
    estimate: z.number().int().nonnegative(),
  }),
  foodPlan: z.array(DietPlanFoodItem).min(1),
  disclaimer: z.string().default(
    "These values are estimates for general guidance only and are not medical advice. Food suggestions are filtered on a best-effort basis and cannot guarantee compliance with dietary restrictions or allergen avoidance — always verify ingredients independently. Consult a registered dietitian or healthcare professional before making significant dietary changes.",
  ),
});

export type DietPlanResult = z.infer<typeof DietPlanResult>;

// ---------------------------------------------------------------------------
// Food & Nutrition AI Assistant (INFO.md / AI_ASSISTANT_SPEC.md)
// ---------------------------------------------------------------------------
// DB reality (verified against the live flavor-ai database): there is NO
// pantry collection and diet plans are never stored (pure calculation), so
// pantry items and daily-plan targets arrive as client-supplied request
// context (same as the recipe generator flow). Only users, recipes, and
// favorites are retrieved server-side — always scoped to req.user.

/** Which context buckets were assembled for an assistant request. */
export const ASSISTANT_CONTEXT = [
  "profile",
  "favorites",
  "pantry",
  "dailyPlan",
  "recipes",
] as const;

/** Client-supplied daily targets (e.g. copied from the /diet-plan page output). */
export const AssistantDailyPlan = z.object({
  calories: z.number().int().positive().max(20000).optional(),
  proteinGrams: z.number().int().nonnegative().max(2000).optional(),
});

export type AssistantDailyPlan = z.infer<typeof AssistantDailyPlan>;

/** A single chat history turn (client-supplied recent window only). */
export const AssistantHistoryTurn = z.object({
  role: z.enum(["user", "assistant"]),
  message: z.string().min(1).max(2000),
});

export type AssistantHistoryTurn = z.infer<typeof AssistantHistoryTurn>;

export const AssistantChatInput = z.object({
  message: z.string().trim().min(1, "Message cannot be empty").max(2000),
  pantryItems: z.array(z.union([z.string().min(1).max(100), IngredientInput])).max(50).default([]),
  dailyPlan: AssistantDailyPlan.optional(),
  history: z.array(AssistantHistoryTurn).max(10).default([]),
});

export type AssistantChatInput = z.infer<typeof AssistantChatInput>;

export const AssistantChatResult = z.object({
  message: z.string().min(1),
  contextUsed: z.array(z.enum(ASSISTANT_CONTEXT)),
});

export type AssistantChatResult = z.infer<typeof AssistantChatResult>;

export const AssistantRecommendationInput = z.object({
  goal: z.string().trim().max(200).optional(),
  limit: z.number().int().min(1).max(20).default(5),
  pantryItems: z.array(z.union([z.string().min(1).max(100), IngredientInput])).max(50).default([]),
  dailyPlan: AssistantDailyPlan.optional(),
});

export type AssistantRecommendationInput = z.infer<typeof AssistantRecommendationInput>;

export const AssistantRecommendation = z.object({
  recipeId: ObjectIdString,
  title: z.string().min(1).max(120),
  reason: z.string().min(3).max(300),
  matchScore: z.number().min(0).max(100),
});

export type AssistantRecommendation = z.infer<typeof AssistantRecommendation>;

export const AssistantRecommendationResult = z.object({
  recommendations: z.array(AssistantRecommendation),
});

export type AssistantRecommendationResult = z.infer<typeof AssistantRecommendationResult>;

export const PantrySuggestionsInput = z.object({
  pantryItems: z
    .array(z.union([z.string().min(1).max(100), IngredientInput]))
    .min(1, "At least one pantry item is required")
    .max(50),
  limit: z.number().int().min(1).max(20).default(5),
});

export type PantrySuggestionsInput = z.infer<typeof PantrySuggestionsInput>;

export const PantrySuggestion = AssistantRecommendation.extend({
  usedCount: z.number().int().nonnegative(),
  missingCount: z.number().int().nonnegative(),
});

export type PantrySuggestion = z.infer<typeof PantrySuggestion>;

export const PantrySuggestionsResult = z.object({
  suggestions: z.array(PantrySuggestion),
});

export type PantrySuggestionsResult = z.infer<typeof PantrySuggestionsResult>;

export const MacroAdjustmentInput = z.object({
  request: z.string().trim().min(1, "Request cannot be empty").max(500),
  dailyPlan: AssistantDailyPlan.optional(),
});

export type MacroAdjustmentInput = z.infer<typeof MacroAdjustmentInput>;

export const MacroAdjustmentResult = z.object({
  recommendation: z.object({
    calories: z.number().int().nonnegative(),
    proteinGrams: z.number().int().nonnegative(),
    carbohydratesGrams: z.number().int().nonnegative(),
    fatGrams: z.number().int().nonnegative(),
  }),
  changes: z.array(
    z.object({
      meal: z.string().min(1).max(100),
      change: z.string().min(3).max(300),
    }),
  ),
  reason: z.string().min(3).max(500),
});

export type MacroAdjustmentResult = z.infer<typeof MacroAdjustmentResult>;

// ---------------------------------------------------------------------------
// Pantry matching (FR-PANTRY-02/03)
// ---------------------------------------------------------------------------

export const PantryMatchResult = z.object({
  usedIngredients: z.array(z.string().min(1)),
  missingIngredients: z.array(z.string().min(1)),
  usageCount: z.number().int().nonnegative(),
  missingCount: z.number().int().nonnegative(),
});

export type PantryMatchResult = z.infer<typeof PantryMatchResult>;

// ---------------------------------------------------------------------------
// Recipe DTO (manual + AI, FR-RECIPE-01/02)
// ---------------------------------------------------------------------------

export const RecipeIngredient = z.object({
  name: z.string().min(1).max(100),
  quantity: z.number().nonnegative().optional(),
  unit: z.string().max(30).optional(),
  notes: z.string().max(200).optional(),
  pantryMatch: z.enum(["used", "missing", "substitution"]).optional(),
});

export type RecipeIngredient = z.infer<typeof RecipeIngredient>;

export const RecipeStep = z.object({
  stepNumber: z.number().int().positive(),
  instruction: z.string().min(3).max(1000),
});

export type RecipeStep = z.infer<typeof RecipeStep>;

export const CreateRecipeInput = z.object({
  title: z.string().min(3).max(120),
  slug: z
    .string()
    .min(3)
    .max(160)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  summary: z.string().max(500).optional(),
  imageUrl: z.string().url().max(500).optional(),
  ingredients: z.array(RecipeIngredient).min(1),
  steps: z.array(RecipeStep).min(1).max(50),
  prepTimeMinutes: z.number().int().nonnegative(),
  cookTimeMinutes: z.number().int().nonnegative(),
  servings: z.number().int().min(1).max(20),
  difficulty: z.enum(DIFFICULTY),
  cuisine: z.string().max(50).optional(),
  category: z.enum(RECIPE_CATEGORY).optional(),
  tags: z.array(z.string().max(50)).default([]),
  dietaryLabels: z.array(z.enum(DIETARY_LABEL)).default([]),
  allergenWarnings: z.array(z.string()).default([]),
  nutrition: NutritionEstimate.optional(),
  /** Additive: lets the AI generator persist `source: "ai"` so saved AI recipes keep their badge/disclaimers. Defaults to `"manual"`; omitted by the manual form. */
  source: z.enum(RECIPE_SOURCE).optional().default("manual"),
});

export type CreateRecipeInput = z.infer<typeof CreateRecipeInput>;

/** Source is set at creation and immutable afterwards — PATCH cannot flip manual<->ai. */
export const UpdateRecipeInput = CreateRecipeInput.omit({ source: true }).partial();

export type UpdateRecipeInput = z.infer<typeof UpdateRecipeInput>;

export const RecipeSearchQuery = PaginationQuery.extend({
  q: z.string().max(200).optional(),
  category: z.enum(RECIPE_CATEGORY).optional(),
  cuisine: z.string().max(50).optional(),
  diet: z.enum(DIETARY_LABEL).optional(),
  difficulty: z.enum(DIFFICULTY).optional(),
  maxCookingTimeMinutes: z.coerce.number().int().positive().optional(),
  sort: z.enum(["newest", "highest-rated", "most-popular"]).default("newest"),
  /** Additive: scopes results to the caller's own recipes across all statuses (auth required). */
  mine: z.coerce.boolean().optional(),
  /** Additive: only honored alongside `mine=true` (see searchRecipes). */
  status: z.enum(RECIPE_STATUS).optional(),
});

export type RecipeSearchQuery = z.infer<typeof RecipeSearchQuery>;

// ---------------------------------------------------------------------------
// Rating DTO (FR-RATE-01..05)
// ---------------------------------------------------------------------------

export const RatingValue = z.number().int().min(1).max(5);

export const CreateRatingInput = z.object({
  value: RatingValue,
});

export const UpdateRatingInput = z.object({
  value: RatingValue,
});

export const RatingSummary = z.object({
  averageRating: z.number().min(0).max(5),
  ratingCount: z.number().int().nonnegative(),
  /** The authenticated caller's own rating, when present; omitted for guests. */
  myRating: RatingValue.nullable().optional(),
});

export type CreateRatingInput = z.infer<typeof CreateRatingInput>;
export type UpdateRatingInput = z.infer<typeof UpdateRatingInput>;
export type RatingSummary = z.infer<typeof RatingSummary>;

// ---------------------------------------------------------------------------
// Comment DTO (FR-COMMENT-01..05)
// ---------------------------------------------------------------------------

export const CreateCommentInput = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
});

export const UpdateCommentInput = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
});

export type CreateCommentInput = z.infer<typeof CreateCommentInput>;
export type UpdateCommentInput = z.infer<typeof UpdateCommentInput>;

// ---------------------------------------------------------------------------
// Email/password credentials (FR-AUTH-01/02/07)
// ---------------------------------------------------------------------------

export const CredentialSignUpInput = z.object({
  name: z.string().trim().min(1, "Display name is required").max(100),
  email: z.string().trim().toLowerCase().email("Please provide a valid email address").max(254),
  password: z.string().min(8, "Password must be at least 8 characters long.").max(128),
});

export type CredentialSignUpInput = z.infer<typeof CredentialSignUpInput>;

export const CredentialSignInInput = z.object({
  email: z.string().trim().toLowerCase().email("Please provide a valid email address").max(254),
  password: z.string().min(1, "Password is required").max(128),
});

export type CredentialSignInInput = z.infer<typeof CredentialSignInInput>;

// ---------------------------------------------------------------------------
// User profile / preferences (FR-AUTH-06)
// ---------------------------------------------------------------------------

export const UpdateProfileInput = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  bio: z.string().max(500).optional(),
  preferences: DietaryPreferences.optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileInput>;

// ---------------------------------------------------------------------------
// Admin moderation (FR-ADMIN-01..04)
// ---------------------------------------------------------------------------

export const AdminUserSearchQuery = PaginationQuery.extend({
  q: z.string().max(200).optional(),
  role: z.enum(USER_ROLE).optional(),
});

export type AdminUserSearchQuery = z.infer<typeof AdminUserSearchQuery>;

export const AdminRecipeSearchQuery = PaginationQuery.extend({
  q: z.string().max(200).optional(),
  status: z.enum(RECIPE_STATUS).optional(),
});

export type AdminRecipeSearchQuery = z.infer<typeof AdminRecipeSearchQuery>;

/** Admin may only toggle published <-> hidden; draft/publish workflow stays owner-driven (M3). */
export const AdminRecipeModerationInput = z.object({
  status: z.enum(["published", "hidden"]),
});

export type AdminRecipeModerationInput = z.infer<typeof AdminRecipeModerationInput>;

export const AdminCommentSearchQuery = PaginationQuery.extend({
  recipeId: ObjectIdString.optional(),
  moderationStatus: z.enum(COMMENT_STATUS).optional(),
});

export type AdminCommentSearchQuery = z.infer<typeof AdminCommentSearchQuery>;

export const AdminCommentModerationInput = z.object({
  moderationStatus: z.enum(COMMENT_STATUS),
});

export type AdminCommentModerationInput = z.infer<typeof AdminCommentModerationInput>;

// ---------------------------------------------------------------------------
// Pantry (Dev A) — Real Pantry Management (FEATURES_TASKS.md §2)
// Frozen vocabulary: categories + units + YYYY-MM-DD UTC dates (§1.1).
// Dev A appends PantryCategory / CreatePantryItemInput / UpdatePantryItemInput /
// UsePantryItemInput / PantrySearchQuery below. Other workstreams do not edit.
// ---------------------------------------------------------------------------

/** Frozen pantry/grocery categories (§1.1). `frozen` is storage form, not kind. */
export const PANTRY_CATEGORY = [
  "vegetables",
  "fruits",
  "meat",
  "dairy",
  "grains",
  "spices",
  "frozen",
  "snacks",
  "other",
] as const;

export const PantryCategory = z.enum(PANTRY_CATEGORY);

export type PantryCategory = z.infer<typeof PantryCategory>;

/**
 * Parses a `YYYY-MM-DD` string into a UTC-midnight Date.
 * Returns `null` for wrong format or impossible calendar dates (e.g. month 13).
 */
function parsePantryDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** `YYYY-MM-DD` string that is a real calendar date today or in the future. */
const PantryExpiryDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must use YYYY-MM-DD format.")
  .refine(
    (value) => {
      const date = parsePantryDate(value);
      if (!date) return false;
      const now = new Date();
      const todayUTC = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      return date.getTime() >= todayUTC.getTime();
    },
    { message: "Expiry date must be a valid calendar date today or in the future." },
  );

export const CreatePantryItemInput = z.object({
  name: z.string().trim().min(1, "Ingredient name is required.").max(100),
  quantity: z.number().nonnegative("Quantity must be 0 or greater."),
  unit: z.string().trim().min(1, "Unit is required.").max(30),
  category: PantryCategory,
  expiryDate: PantryExpiryDate.nullable().optional(),
  lowStockThreshold: z.number().nonnegative().nullable().optional(),
  notes: z.string().trim().max(200).optional(),
});

export type CreatePantryItemInput = z.infer<typeof CreatePantryItemInput>;

/** All fields optional — ownership + key recompute handled in the controller. */
export const UpdatePantryItemInput = CreatePantryItemInput.partial();

export type UpdatePantryItemInput = z.infer<typeof UpdatePantryItemInput>;

/** Consume flow: conditional atomic decrement, never clamps to zero. */
export const UsePantryItemInput = z.object({
  quantity: z.number().positive("Quantity must be greater than 0."),
});

export type UsePantryItemInput = z.infer<typeof UsePantryItemInput>;

/**
 * Query-string boolean: accepts `?flag=true` / `?flag=false` (and real
 * booleans). `z.coerce.boolean()` is deliberately avoided — `Boolean("false")`
 * is `true`, so an explicit `?lowStock=false` would wrongly apply the filter.
 */
const QueryBoolean = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) => value === true || value === "true");

export const PantrySearchQuery = PaginationQuery.extend({
  category: PantryCategory.optional(),
  q: z.string().max(200).optional(),
  expiringWithinDays: z.coerce.number().int().min(1).max(365).optional(),
  lowStock: QueryBoolean.optional(),
});

export type PantrySearchQuery = z.infer<typeof PantrySearchQuery>;

// ---------------------------------------------------------------------------
// MealPlan (Dev B) — Smart Meal Planning (FEATURES_TASKS.md §3)
// status: active|archived + isFavorite flag; servings 1–20; slot uniqueness
// on (date, mealType); swap addressed by mealId (§1.1, §B1).
// Dev B appends constraints / meal / create / update / AI-generate / swap schemas
// below. Other workstreams do not edit.
// ---------------------------------------------------------------------------

/** Plan lifecycle: `active` <-> `archived`. Favorite is a separate flag. */
export const MEAL_PLAN_STATUS = ["active", "archived"] as const;

export const MealPlanStatus = z.enum(MEAL_PLAN_STATUS);

export type MealPlanStatus = z.infer<typeof MealPlanStatus>;

/** Meal origin: manual placement, AI generation, single-meal swap, optimization pass. */
export const MEAL_PLAN_MEAL_SOURCE = ["manual", "ai", "swap", "optimized"] as const;

export const MealPlanMealSource = z.enum(MEAL_PLAN_MEAL_SOURCE);

export type MealPlanMealSource = z.infer<typeof MealPlanMealSource>;

/**
 * Parses a `YYYY-MM-DD` string into a UTC-midnight Date.
 * Returns `null` for wrong format or impossible calendar dates.
 * Unlike pantry expiry, plan dates may lie in the past (history / favorites reuse).
 */
function parsePlanDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** `YYYY-MM-DD` string that is a real calendar date (past, present, or future). */
const PlanDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format.")
  .refine((value) => parsePlanDate(value) !== null, {
    message: "Date must be a valid calendar date.",
  });

/** Snapshotted generation constraints stored on the plan (FEATURES_TASKS.md §B1). */
export const MealPlanConstraints = z.object({
  days: z.number().int().min(1).max(7).optional(),
  mealsPerDay: z.array(z.enum(MEAL_TYPE)).optional(),
  servings: z.number().int().min(1).max(20).optional(),
  calorieTarget: z.number().int().positive().optional(),
  proteinTargetGrams: z.number().int().positive().optional(),
  dietaryLabels: z.array(z.enum(DIETARY_LABEL)).optional(),
  cuisine: z.string().max(50).optional(),
  budget: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

export type MealPlanConstraints = z.infer<typeof MealPlanConstraints>;

/** One placed meal. Subdoc `_id` serves as `mealId` for swap/remove/move. */
export const MealPlanMealInput = z.object({
  date: PlanDateString,
  mealType: z.enum(MEAL_TYPE),
  recipeId: ObjectIdString,
  servings: z.number().int().min(1).max(20),
  source: z.enum(MEAL_PLAN_MEAL_SOURCE).default("manual"),
  notes: z.string().max(200).optional(),
});

export type MealPlanMealInput = z.infer<typeof MealPlanMealInput>;

/**
 * Update variant: `source` stays optional with NO default so a full-array
 * PATCH that omits `source` preserves provenance instead of resetting to
 * `"manual"`. The controller fills missing `source` from the stored meal.
 */
export const MealPlanMealUpdateInput = z.object({
  date: PlanDateString,
  mealType: z.enum(MEAL_TYPE),
  recipeId: ObjectIdString,
  servings: z.number().int().min(1).max(20),
  source: z.enum(MEAL_PLAN_MEAL_SOURCE).optional(),
  notes: z.string().max(200).optional(),
});

export type MealPlanMealUpdateInput = z.infer<typeof MealPlanMealUpdateInput>;

/**
 * Slot-uniqueness check shared by create/update refinements: at most one
 * meal per `(date, mealType)` per plan, so swap-by-`mealId` is never ambiguous.
 */
function assertUniqueMealSlots(
  meals: Array<{ date: string; mealType: string }>,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  meals.forEach((meal, index) => {
    const slot = `${meal.date}|${meal.mealType}`;
    if (seen.has(slot)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate meal slot: only one meal per date and meal type is allowed.",
        path: ["meals", index, "mealType"],
      });
    }
    seen.add(slot);
  });
}

/** `weekEndDate > weekStartDate`, every meal date inside range, unique slots. */
function refineMealPlanRange(
  value: {
    weekStartDate?: string;
    weekEndDate?: string;
    meals?: Array<{ date: string; mealType: string }>;
  },
  ctx: z.RefinementCtx,
): void {
  const { weekStartDate, weekEndDate, meals } = value;
  if (weekStartDate !== undefined && weekEndDate !== undefined) {
    const start = parsePlanDate(weekStartDate);
    const end = parsePlanDate(weekEndDate);
    if (start !== null && end !== null && end.getTime() <= start.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "weekEndDate must be after weekStartDate.",
        path: ["weekEndDate"],
      });
    }
    if (meals !== undefined && start !== null && end !== null) {
      meals.forEach((meal, index) => {
        const date = parsePlanDate(meal.date);
        if (
          date !== null &&
          (date.getTime() < start.getTime() || date.getTime() > end.getTime())
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Meal date must fall inside the plan week.",
            path: ["meals", index, "date"],
          });
        }
      });
    }
  }
  if (meals !== undefined) assertUniqueMealSlots(meals, ctx);
}

export const CreateMealPlanInput = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    weekStartDate: PlanDateString,
    weekEndDate: PlanDateString,
    status: z.enum(MEAL_PLAN_STATUS).default("active"),
    isFavorite: z.boolean().default(false),
    constraints: MealPlanConstraints.optional(),
    /** May be empty — the AI-generate flow creates the shell first. */
    meals: z.array(MealPlanMealInput).default([]),
  })
  .superRefine(refineMealPlanRange);

export type CreateMealPlanInput = z.infer<typeof CreateMealPlanInput>;

/**
 * Explicitly optional with NO defaults: unlike `CreateXInput.partial()`,
 * parsing `{}` must not inject `status: "active"` / `meals: []` and wipe
 * stored values on PATCH. Range/slot checks run on the fields present;
 * the controller re-validates the merged week before saving.
 */
export const UpdateMealPlanInput = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    weekStartDate: PlanDateString.optional(),
    weekEndDate: PlanDateString.optional(),
    status: z.enum(MEAL_PLAN_STATUS).optional(),
    isFavorite: z.boolean().optional(),
    constraints: MealPlanConstraints.optional(),
    meals: z.array(MealPlanMealUpdateInput).optional(),
  })
  .superRefine(refineMealPlanRange);

export type UpdateMealPlanInput = z.infer<typeof UpdateMealPlanInput>;

/**
 * `YYYY-MM-DD` + N days (UTC), returned as `YYYY-MM-DD`.
 * Local copy (service has its own) so the AI range refinement can compare
 * `weekEndDate` against `start + days - 1` without importing services.
 */
function addDaysToYMD(startYMD: string, days: number): string {
  const [year, month, day] = startYMD.split("-").map(Number);
  const base = Date.UTC(year, month - 1, day);
  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export const AIGenerateMealPlanInput = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    /** Anchor week; `weekEndDate` may be omitted — server computes `start + days − 1`. */
    weekStartDate: PlanDateString,
    weekEndDate: PlanDateString.optional(),
    days: z.number().int().min(1).max(7).default(7),
    mealsPerDay: z
      .array(z.enum(MEAL_TYPE))
      .min(1)
      .max(5)
      .default(["breakfast", "lunch", "dinner"])
      .refine((types) => new Set(types).size === types.length, {
        message: "mealsPerDay must not contain duplicates.",
      }),
    servings: z.number().int().min(1).max(20).default(2),
    calorieTarget: z.number().int().positive().optional(),
    proteinTargetGrams: z.number().int().positive().optional(),
    dietaryLabels: z.array(z.enum(DIETARY_LABEL)).default([]),
    cuisine: z.string().max(50).optional(),
    maxCookingTimeMinutes: z.number().int().positive().optional(),
    prioritizePantry: z.boolean().default(true),
    avoidIngredients: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
    budget: z.number().nonnegative().optional(),
    notes: z.string().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.weekEndDate === undefined) return;
    const start = parsePlanDate(value.weekStartDate);
    const end = parsePlanDate(value.weekEndDate);
    if (start !== null && end !== null) {
      if (end.getTime() <= start.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "weekEndDate must be after weekStartDate.",
          path: ["weekEndDate"],
        });
        return;
      }
      const expected = addDaysToYMD(value.weekStartDate, value.days - 1);
      if (value.weekEndDate !== expected) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `weekEndDate must equal weekStartDate + days - 1 (${expected}).`,
          path: ["weekEndDate"],
        });
      }
    }
  });

export type AIGenerateMealPlanInput = z.infer<typeof AIGenerateMealPlanInput>;

/** Exactly one meal, addressed by subdoc `_id`; everything else stays identical. */
export const SwapMealInput = z.object({
  mealId: ObjectIdString,
  notes: z.string().max(500).optional(),
});

export type SwapMealInput = z.infer<typeof SwapMealInput>;

/** List filter: `?status=` tabs + `?isFavorite=true` Favorites tab. */
export const MealPlanListQuery = PaginationQuery.extend({
  status: z.enum(MEAL_PLAN_STATUS).optional(),
  isFavorite: QueryBoolean.optional(),
});

export type MealPlanListQuery = z.infer<typeof MealPlanListQuery>;

// ---------------------------------------------------------------------------
// Grocery (Dev C) — Smart Grocery System (FEATURES_TASKS.md §4)
// Canonical base units via Dev-A utils/units.ts; no estimatedCost in v1 (§1.1).
// Dev C appends Generate / Add / Update-item / Update-list inputs below.
// Other workstreams do not edit.
// ---------------------------------------------------------------------------

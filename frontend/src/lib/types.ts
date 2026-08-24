export type UserRole = "user" | "admin";

export type DietaryLabel =
  | "vegetarian"
  | "vegan"
  | "halal"
  | "gluten-free"
  | "dairy-free"
  | "high-protein"
  | "low-carb"
  | "keto";

export type RecipeStatus = "draft" | "published" | "hidden";
export type RecipeSource = "manual" | "ai";
export type Difficulty = "easy" | "medium" | "hard";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "dessert";

export type RecipeCategory =
  | "main-course"
  | "appetizer"
  | "soup"
  | "salad"
  | "side-dish"
  | "baking"
  | "beverage";

export type CommentStatus = "visible" | "moderated";
export type PantryMatchStatus = "used" | "missing" | "substitution";
export type RecipeSort = "newest" | "highest-rated" | "most-popular";
export type RatingValue = 1 | 2 | 3 | 4 | 5;

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "AI_PROVIDER_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ErrorEnvelope {
  status: number;
  code: ErrorCode;
  safeMessage: string;
  validation?: Record<string, string>;
}

export interface CalorieRange {
  min: number;
  max: number;
}

export interface DietaryPreferences {
  dietaryLabels: DietaryLabel[];
  allergies: string[];
  dislikedIngredients: string[];
  calorieTarget?: number;
  calorieRange?: CalorieRange;
  proteinTargetGrams?: number;
  cookingTimeMaxMinutes?: number;
  difficulty?: Difficulty;
}

export interface IngredientInput {
  name: string;
  quantity?: number;
  unit?: string;
}

export interface AIRecipePromptInput {
  ingredients: Array<string | IngredientInput>;
  mealType?: MealType;
  cuisine?: string;
  servings?: number;
  maxCookingTimeMinutes?: number;
  difficulty?: Difficulty;
  availableEquipment?: string[];
  excludedIngredients?: string[];
  preferences?: DietaryPreferences;
}

export interface NutritionEstimate {
  caloriesPerServing: number | null;
  proteinGramsPerServing: number | null;
  carbsGramsPerServing: number | null;
  fatGramsPerServing: number | null;
  fiberGramsPerServing?: number | null;
  sugarGramsPerServing?: number | null;
  sodiumMgPerServing?: number | null;
}

export interface RecipeIngredient {
  name: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  pantryMatch?: PantryMatchStatus;
}

export interface RecipeStep {
  stepNumber: number;
  instruction: string;
}

export interface AIRecipeOutput {
  title: string;
  summary: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  difficulty: Difficulty;
  cuisine?: string;
  category?: RecipeCategory;
  tags: string[];
  dietaryLabels: DietaryLabel[];
  allergenWarnings: string[];
  nutrition?: NutritionEstimate;
}

export interface PantryMatchResult {
  usedIngredients: string[];
  missingIngredients: string[];
  usageCount: number;
  missingCount: number;
}

export interface FlavorPairingInput {
  ingredient: string;
  preferences?: DietaryPreferences;
}

export interface FlavorPairingSuggestion {
  ingredient: string;
  reason: string;
  type: "addition" | "substitution";
}

export interface CreateRecipeInput {
  title: string;
  slug: string;
  summary?: string;
  imageUrl?: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  difficulty: Difficulty;
  cuisine?: string;
  category?: RecipeCategory;
  tags?: string[];
  dietaryLabels?: DietaryLabel[];
  allergenWarnings?: string[];
  nutrition?: NutritionEstimate;
}

export type UpdateRecipeInput = Partial<CreateRecipeInput>;

export interface Recipe {
  id: string;
  owner: string;
  source: RecipeSource;
  title: string;
  slug: string;
  summary?: string;
  imageUrl?: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  servings: number;
  difficulty: Difficulty;
  cuisine?: string;
  category?: RecipeCategory;
  tags: string[];
  dietaryLabels: DietaryLabel[];
  allergenWarnings: string[];
  nutrition?: NutritionEstimate;
  status: RecipeStatus;
  averageRating: number;
  ratingCount: number;
  favoriteCount: number;
  commentCount: number;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeSearchQuery extends PaginationQuery {
  q?: string;
  category?: RecipeCategory;
  cuisine?: string;
  diet?: DietaryLabel;
  difficulty?: Difficulty;
  maxCookingTimeMinutes?: number;
  sort?: RecipeSort;
}

export interface CreateRatingInput {
  value: RatingValue;
}

export type UpdateRatingInput = CreateRatingInput;

export interface RatingSummary {
  averageRating: number;
  ratingCount: number;
}

export interface Rating {
  id: string;
  recipe: string;
  user: string;
  value: RatingValue;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommentInput {
  body: string;
}

export type UpdateCommentInput = CreateCommentInput;

export interface Comment {
  id: string;
  recipe: string;
  user: string;
  body: string;
  moderationStatus: CommentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string;
  role: UserRole;
  preferences: DietaryPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  avatarUrl?: string | null;
  bio?: string;
  preferences?: DietaryPreferences;
}

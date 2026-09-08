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

export type TasteProfile = "spicy" | "sweet" | "salty" | "sour" | "bitter" | "umami";
export type TasteIntensity = "mild" | "medium" | "strong";

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

// ---------------------------------------------------------------------------
// AI Taste Matcher (FR-TASTE-01..03) — Additive (post-freeze)
// ---------------------------------------------------------------------------

export interface TasteMatchInput {
  tastes: TasteProfile[];
  intensity?: TasteIntensity;
  notes?: string;
  limit?: number;
}

export interface TasteMatchResult {
  recipe: RecipeCardData;
  score: number;
  matchedTastes: TasteProfile[];
  reason: string;
}

// ---------------------------------------------------------------------------
// Food Photo Nutrition Analysis (FR-PHOTO-01..04)
// ---------------------------------------------------------------------------

export interface NutritionRange {
  min: number;
  max: number;
  estimate: number;
}

export interface DetectedFoodItem {
  name: string;
  portion: string;
  confidence: "high" | "medium" | "low";
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams?: number;
}

export interface FoodPhotoAnalysisInput {
  image: string;
  mimeType?: string;
  filename?: string;
  mealContext?: string;
  notes?: string;
}

export interface FoodPhotoAnalysisResult {
  dishName: string;
  summary: string;
  detectedFoods: DetectedFoodItem[];
  totalNutrition: {
    calories: NutritionRange;
    proteinGrams: NutritionRange;
    carbsGrams: NutritionRange;
    fatGrams: NutritionRange;
    fiberGrams?: NutritionRange;
  };
  macroDistribution: {
    proteinPercentage: number;
    carbsPercentage: number;
    fatPercentage: number;
  };
  dietaryTags: DietaryLabel[];
  allergenWarnings: string[];
  healthInsights: string[];
  suggestedIngredientsForRecipe: string[];
  disclaimer: string;
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

/** The subset of `Recipe` that `RecipeCard` actually renders — shared with
 * lighter-weight card projections (e.g. the favorites feed) that don't
 * return a full `Recipe`. */
export type RecipeCardData = Pick<
  Recipe,
  | "id"
  | "title"
  | "slug"
  | "summary"
  | "imageUrl"
  | "category"
  | "difficulty"
  | "dietaryLabels"
  | "source"
  | "status"
  | "averageRating"
  | "ratingCount"
  | "favoriteCount"
  | "totalTimeMinutes"
>;

export interface FavoriteItem {
  id: string;
  recipe: RecipeCardData;
  createdAt: string;
}

export interface RecipeSearchQuery extends PaginationQuery {
  q?: string;
  category?: RecipeCategory;
  cuisine?: string;
  diet?: DietaryLabel;
  difficulty?: Difficulty;
  maxCookingTimeMinutes?: number;
  sort?: RecipeSort;
  /** Additive: scopes results to the caller's own recipes across all statuses (auth required). */
  mine?: boolean;
  /** Additive: only honored alongside `mine: true`. */
  status?: RecipeStatus;
}

/** Additive (post-freeze): `GET /users/me/stats`. */
export interface DashboardStats {
  totalRecipes: number;
  draftCount: number;
  publishedCount: number;
  hiddenCount: number;
  totalRatingsReceived: number;
  totalFavoritesReceived: number;
  totalCommentsReceived: number;
  averageRating: number;
}

export interface CreateRatingInput {
  value: RatingValue;
}

export type UpdateRatingInput = CreateRatingInput;

export interface RatingSummary {
  averageRating: number;
  ratingCount: number;
  /** The caller's own rating when authenticated; omitted entirely for guests. */
  myRating?: RatingValue | null;
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
  /** Author display name, when known; null if the user reference didn't resolve. */
  authorName: string | null;
  authorAvatarUrl: string | null;
  body: string;
  moderationStatus: CommentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FavoriteStatus {
  favorited: boolean;
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

// ─── Admin (FR-ADMIN-01..04) ─────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserSearchQuery extends PaginationQuery {
  q?: string;
  role?: UserRole;
}

export interface AdminRecipe {
  id: string;
  title: string;
  slug: string;
  owner: string;
  status: RecipeStatus;
  averageRating: number;
  ratingCount: number;
  favoriteCount: number;
  commentCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRecipeSearchQuery extends PaginationQuery {
  q?: string;
  status?: RecipeStatus;
}

/** Admin may only toggle published <-> hidden; draft/publish stays the owner's workflow. */
export interface AdminRecipeModerationInput {
  status: "published" | "hidden";
}

export interface AdminComment {
  id: string;
  recipe: string;
  user: string;
  body: string;
  moderationStatus: CommentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCommentSearchQuery extends PaginationQuery {
  recipeId?: string;
  moderationStatus?: CommentStatus;
}

export interface AdminCommentModerationInput {
  moderationStatus: CommentStatus;
}

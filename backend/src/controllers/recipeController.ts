import type { Request, Response } from "express";
import { Types, type FilterQuery, type HydratedDocument } from "mongoose";
import { isOwnerOrAdmin } from "../middleware/auth.js";
import { RecipeModel, type Recipe } from "../models/Recipe.js";
import type { CreateRecipeInput, RecipeSearchQuery, UpdateRecipeInput } from "../types/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function isValidObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value);
}

/** Serializes a Recipe doc into the frozen contract shape (docs/API_CONTRACT.md). */
export function toRecipeResponse(recipe: HydratedDocument<Recipe>) {
  return {
    id: recipe._id.toString(),
    owner: recipe.owner.toString(),
    source: recipe.source,
    title: recipe.title,
    slug: recipe.slug,
    summary: recipe.summary,
    imageUrl: recipe.imageUrl,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    totalTimeMinutes: recipe.totalTimeMinutes,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    cuisine: recipe.cuisine,
    category: recipe.category,
    tags: recipe.tags,
    dietaryLabels: recipe.dietaryLabels,
    allergenWarnings: recipe.allergenWarnings,
    nutrition: recipe.nutrition,
    status: recipe.status,
    publishedAt: recipe.publishedAt,
    averageRating: recipe.averageRating,
    ratingCount: recipe.ratingCount,
    favoriteCount: recipe.favoriteCount,
    commentCount: recipe.commentCount,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  };
}

/**
 * GET /recipes — public, paginated search over published recipes (FR-SEARCH).
 * Supports q (text index on title/summary/ingredients), category, cuisine,
 * diet, difficulty, maxCookingTimeMinutes, sort, page, limit.
 *
 * **Additive (post-freeze):** `?mine=true` (requires auth, via `optionalAuth`
 * on the route) switches the base filter from `status: "published"` to the
 * caller's own `owner`, across every status — this is what powers the
 * frontend dashboard's "my drafts/published/hidden" view, which otherwise
 * had no endpoint (the public filter deliberately never leaks drafts,
 * Business Rules 3/4/10). `status` is only honored alongside `mine=true`;
 * outside of `mine`, status stays hardcoded to `"published"` regardless of
 * whether a `status` query param is sent, so public discovery is unaffected.
 */
export const searchRecipes = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as RecipeSearchQuery;

  const filter: FilterQuery<Recipe> = {};
  if (query.mine) {
    if (!req.user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required to view your own recipes.");
    }
    filter.owner = req.user.id;
    if (query.status) filter.status = query.status;
  } else {
    filter.status = "published";
  }

  if (query.q?.trim()) {
    filter.$text = { $search: query.q.trim() };
  }
  if (query.category) filter.category = query.category;
  if (query.cuisine) filter.cuisine = query.cuisine;
  if (query.diet) filter.dietaryLabels = query.diet;
  if (query.difficulty) filter.difficulty = query.difficulty;
  if (query.maxCookingTimeMinutes) {
    filter.totalTimeMinutes = { $lte: query.maxCookingTimeMinutes };
  }

  // Drafts/hidden recipes have no publishedAt, which sorts unpredictably
  // under the public "newest" sort — "mine" always sorts by createdAt instead.
  const sort = query.mine ? { createdAt: -1 as const } : buildSort(query.sort);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    RecipeModel.find(filter).sort(sort).skip(skip).limit(query.limit),
    RecipeModel.countDocuments(filter),
  ]);

  res.json({
    items: items.map(toRecipeResponse),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  });
});

function buildSort(sort: RecipeSearchQuery["sort"]): Record<string, 1 | -1> {
  switch (sort) {
    case "highest-rated":
      return { averageRating: -1, ratingCount: -1 };
    case "most-popular":
      return { favoriteCount: -1, averageRating: -1 };
    case "newest":
    default:
      return { publishedAt: -1, createdAt: -1 };
  }
}

/**
 * POST /recipes — create a manual recipe. Always saved as a draft owned by the
 * authenticated user (FR-RECIPE-01). Duplicate slug → 409 via error handler.
 */
export const createRecipe = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  const input = req.body as CreateRecipeInput;
  const recipe = await RecipeModel.create({
    ...input,
    owner: user.id,
    source: "manual",
    status: "draft",
  });

  res.status(201).json({ recipe: toRecipeResponse(recipe) });
});

/**
 * GET /recipes/:id — public for published recipes. Drafts/hidden are only
 * visible to owner/admin; others receive 404 so the draft's existence is not
 * leaked (Business Rules 3/4/10).
 */
export const getRecipe = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid recipe id.");
  }

  const recipe = await RecipeModel.findById(id);
  if (!recipe) {
    throw new ApiError(404, "NOT_FOUND", "Recipe not found.");
  }

  const isOwner = recipe.owner.toString() === req.user?.id;
  const isAdmin = req.user?.role === "admin";
  if (recipe.status !== "published" && !isOwner && !isAdmin) {
    throw new ApiError(404, "NOT_FOUND", "Recipe not found.");
  }

  res.json({ recipe: toRecipeResponse(recipe) });
});

/**
 * PATCH /recipes/:id — owner/admin only (FR-RECIPE-06). Recomputes
 * totalTimeMinutes because the model hook only runs on `save` (AGENTS.md).
 */
export const updateRecipe = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid recipe id.");
  }

  const recipe = await RecipeModel.findById(id);
  if (!recipe) {
    throw new ApiError(404, "NOT_FOUND", "Recipe not found.");
  }
  if (!isOwnerOrAdmin(recipe.owner, req.user)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to edit this recipe.");
  }

  recipe.set(req.body as UpdateRecipeInput);
  recipe.totalTimeMinutes = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0);
  await recipe.save();

  res.json({ recipe: toRecipeResponse(recipe) });
});

/** DELETE /recipes/:id — owner/admin only (FR-RECIPE-03/06). */
export const deleteRecipe = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid recipe id.");
  }

  const recipe = await RecipeModel.findById(id);
  if (!recipe) {
    throw new ApiError(404, "NOT_FOUND", "Recipe not found.");
  }
  if (!isOwnerOrAdmin(recipe.owner, req.user)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to delete this recipe.");
  }

  await recipe.deleteOne();
  res.status(204).end();
});

/** POST /recipes/:id/publish — owner/admin moves a draft to published. */
export const publishRecipe = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid recipe id.");
  }

  const recipe = await RecipeModel.findById(id);
  if (!recipe) {
    throw new ApiError(404, "NOT_FOUND", "Recipe not found.");
  }
  if (!isOwnerOrAdmin(recipe.owner, req.user)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to publish this recipe.");
  }
  if (recipe.status === "hidden") {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "This recipe is under moderation and cannot be published.",
    );
  }

  if (recipe.status !== "published") {
    recipe.status = "published";
    recipe.publishedAt = new Date();
    await recipe.save();
  }

  res.json({ recipe: toRecipeResponse(recipe) });
});

/** POST /recipes/:id/unpublish — owner/admin moves a published recipe back to draft. */
export const unpublishRecipe = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid recipe id.");
  }

  const recipe = await RecipeModel.findById(id);
  if (!recipe) {
    throw new ApiError(404, "NOT_FOUND", "Recipe not found.");
  }
  if (!isOwnerOrAdmin(recipe.owner, req.user)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to unpublish this recipe.");
  }
  if (recipe.status === "hidden") {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "This recipe is under moderation and cannot be unpublished.",
    );
  }

  if (recipe.status === "published") {
    recipe.status = "draft";
    recipe.publishedAt = null;
    await recipe.save();
  }

  res.json({ recipe: toRecipeResponse(recipe) });
});

import type { Request, Response } from "express";
import { Types } from "mongoose";
import { FavoriteModel } from "../models/Favorite.js";
import { RecipeModel } from "../models/Recipe.js";
import type { AuthUser } from "../types/auth.js";
import { PaginationQuery } from "../types/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { parseIdParam } from "../utils/params.js";
import { requirePublishedRecipe } from "../utils/recipeAccess.js";

type FavoriteRecord = {
  _id: unknown;
  recipe: unknown;
  user: unknown;
  createdAt?: Date;
};

type FavoritedRecipeCard = {
  _id: unknown;
  title: string;
  slug: string;
  summary?: string | null;
  imageUrl?: string | null;
  difficulty: string;
  cuisine?: string | null;
  category?: string | null;
  dietaryLabels?: string[];
  source?: string;
  totalTimeMinutes?: number;
  averageRating?: number;
  ratingCount?: number;
  favoriteCount?: number;
  commentCount?: number;
  publishedAt?: Date | null;
};

type FavoriteFeedRow = {
  _id: unknown;
  createdAt: Date;
  recipe: FavoritedRecipeCard;
};

function currentUser(req: Request): AuthUser {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
  }
  return req.user;
}

/** Recomputes the recipe's favorite count after any favorite change. */
async function recomputeFavoriteCount(recipeId: string): Promise<number> {
  const favoriteCount = await FavoriteModel.countDocuments({ recipe: recipeId });
  await RecipeModel.updateOne({ _id: recipeId }, { $set: { favoriteCount } });
  return favoriteCount;
}

function toFavoriteResponse(record: FavoriteRecord, recipeId: string, userId: string) {
  return {
    id: String(record._id),
    recipe: recipeId,
    user: userId,
    createdAt: (record.createdAt ?? new Date()).toISOString(),
  };
}

function toFavoriteFeedItem(row: FavoriteFeedRow) {
  const recipe = row.recipe;
  return {
    id: String(row._id),
    recipe: {
      id: String(recipe._id),
      title: recipe.title,
      slug: recipe.slug,
      summary: recipe.summary ?? "",
      imageUrl: recipe.imageUrl ?? null,
      difficulty: recipe.difficulty,
      cuisine: recipe.cuisine ?? null,
      category: recipe.category ?? null,
      // Guaranteed by the $lookup pipeline's own status: "published" match above.
      status: "published" as const,
      dietaryLabels: recipe.dietaryLabels ?? [],
      source: recipe.source ?? "manual",
      totalTimeMinutes: recipe.totalTimeMinutes ?? 0,
      averageRating: recipe.averageRating ?? 0,
      ratingCount: recipe.ratingCount ?? 0,
      favoriteCount: recipe.favoriteCount ?? 0,
      commentCount: recipe.commentCount ?? 0,
      publishedAt: recipe.publishedAt ? new Date(recipe.publishedAt).toISOString() : null,
    },
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * GET /favorites — own favorites, paginated (FR-FAV-03). Favorites whose
 * recipe is no longer published (unpublished/deleted) are excluded from the
 * feed via the `$lookup` + `$unwind` below — the favorite row itself is left
 * intact so it reappears if the recipe is republished (FR-FAV-04).
 */
export const listFavorites = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const { page, limit } = PaginationQuery.parse(req.query);

  const [result] = (await FavoriteModel.aggregate([
    { $match: { user: new Types.ObjectId(user.id) } },
    {
      $lookup: {
        from: "recipes",
        let: { recipeId: "$recipe" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$recipeId"] }, status: "published" } },
          {
            $project: {
              title: 1,
              slug: 1,
              summary: 1,
              imageUrl: 1,
              difficulty: 1,
              cuisine: 1,
              category: 1,
              dietaryLabels: 1,
              source: 1,
              totalTimeMinutes: 1,
              averageRating: 1,
              ratingCount: 1,
              favoriteCount: 1,
              commentCount: 1,
              publishedAt: 1,
            },
          },
        ],
        as: "recipe",
      },
    },
    { $unwind: "$recipe" }, // drops favorites whose recipe was filtered out above
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        totalCount: [{ $count: "count" }],
      },
    },
  ])) as { items: FavoriteFeedRow[]; totalCount: { count: number }[] }[];

  const items = result?.items ?? [];
  const total = result?.totalCount[0]?.count ?? 0;

  res.json({
    items: items.map(toFavoriteFeedItem),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

/**
 * GET /favorites/:recipeId — whether the caller has favorited this recipe.
 * Not part of the originally frozen contract; added additively (new route,
 * existing shapes untouched) so the recipe detail page can render an
 * accurate favorite toggle without paginating the caller's whole list.
 */
export const getFavoriteStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const recipeId = parseIdParam(req.params.recipeId, "recipeId");

  const favorite = await FavoriteModel.findOne({ recipe: recipeId, user: user.id });
  res.status(200).json({ favorited: Boolean(favorite) });
});

/**
 * Atomically upserts the (recipe, user) favorite row, so two concurrent PUTs
 * (e.g. a retry) can't both pass a check-then-act race and hit the unique
 * index as a 409. On the rare chance both requests still collide on insert,
 * the loser falls back to reading the winner's row instead of erroring.
 */
async function upsertFavorite(recipeId: string, userId: string): Promise<FavoriteRecord> {
  try {
    return (await FavoriteModel.findOneAndUpdate(
      { recipe: recipeId, user: userId },
      { $setOnInsert: { recipe: recipeId, user: userId } },
      { upsert: true, new: true },
    )) as FavoriteRecord;
  } catch (err) {
    const code = (err as { code?: number } | null)?.code;
    if (code === 11000) {
      const existing = (await FavoriteModel.findOne({
        recipe: recipeId,
        user: userId,
      })) as FavoriteRecord | null;
      if (existing) return existing;
    }
    throw err;
  }
}

/** PUT /favorites/:recipeId — add a published recipe to favorites, idempotent (FR-FAV-01/02). */
export const addFavorite = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const recipeId = parseIdParam(req.params.recipeId, "recipeId");
  await requirePublishedRecipe(recipeId);

  const record = await upsertFavorite(recipeId, user.id);

  const favoriteCount = await recomputeFavoriteCount(recipeId);

  res.status(200).json({
    favorite: toFavoriteResponse(record, recipeId, user.id),
    favoriteCount,
  });
});

/** DELETE /favorites/:recipeId — remove own favorite, idempotent (FR-FAV-01). */
export const removeFavorite = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const recipeId = parseIdParam(req.params.recipeId, "recipeId");

  // No published-status gate here (unlike PUT): a user must always be able
  // to remove their own favorite, even for a recipe that was since hidden,
  // unpublished, or deleted.
  await FavoriteModel.findOneAndDelete({ recipe: recipeId, user: user.id });
  const favoriteCount = await recomputeFavoriteCount(recipeId);

  res.status(200).json({ success: true, favoriteCount });
});

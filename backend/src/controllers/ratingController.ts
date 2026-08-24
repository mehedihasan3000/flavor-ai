import type { Request, Response } from "express";
import { Types } from "mongoose";
import { RatingModel } from "../models/Rating.js";
import { RecipeModel } from "../models/Recipe.js";
import type { AuthUser } from "../types/auth.js";
import type { RatingSummary } from "../types/index.js";
import { CreateRatingInput } from "../types/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseIdParam } from "../utils/params.js";
import { requirePublishedRecipe } from "../utils/recipeAccess.js";

type RatingRecord = {
  _id: unknown;
  recipe: unknown;
  user: unknown;
  value: number;
  createdAt?: Date;
  updatedAt?: Date;
  save?: () => Promise<unknown>;
};

function currentUser(req: Request): AuthUser {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
  }
  return req.user;
}

/** Recomputes the recipe's rating aggregates after any rating change (FR-RATE-04). */
async function recomputeRatingAggregates(recipeId: string): Promise<RatingSummary> {
  // Raw aggregate() pipelines bypass Mongoose's Query-level casting, so the
  // string id must be cast to ObjectId explicitly or $match never matches
  // the stored ObjectId `recipe` field against real MongoDB.
  const rows = (await RatingModel.aggregate([
    { $match: { recipe: new Types.ObjectId(recipeId) } },
    { $group: { _id: null, average: { $avg: "$value" }, count: { $sum: 1 } } },
  ])) as { _id: null; average: number; count: number }[];

  const first = rows[0];
  const ratingCount = first?.count ?? 0;
  const averageRating = ratingCount > 0 ? Math.round((first?.average ?? 0) * 100) / 100 : 0;

  await RecipeModel.updateOne({ _id: recipeId }, { $set: { averageRating, ratingCount } });

  return { averageRating, ratingCount };
}

function toRatingResponse(record: RatingRecord, recipeId: string, userId: string) {
  return {
    id: String(record._id),
    recipe: recipeId,
    user: userId,
    value: record.value,
    createdAt: (record.createdAt ?? new Date()).toISOString(),
    updatedAt: (record.updatedAt ?? new Date()).toISOString(),
  };
}

/** GET /recipes/:id/ratings — public summary (FR-RATE-04). */
export const getRatingSummary = asyncHandler(async (req: Request, res: Response) => {
  const recipeId = parseIdParam(req.params.id, "id");
  const recipe = await requirePublishedRecipe(recipeId);
  res.json({ averageRating: recipe.averageRating ?? 0, ratingCount: recipe.ratingCount ?? 0 });
});

/** PUT /recipes/:id/ratings — create/update own rating, idempotent (FR-RATE-01..03/05). */
export const upsertRating = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const recipeId = parseIdParam(req.params.id, "id");
  const { value } = CreateRatingInput.parse(req.body);

  const recipe = await requirePublishedRecipe(recipeId);
  if (String(recipe.owner) === user.id) {
    throw new ApiError(403, "FORBIDDEN", "Recipe owners cannot rate their own recipe.");
  }

  const existing = (await RatingModel.findOne({
    recipe: recipeId,
    user: user.id,
  })) as RatingRecord | null;

  let record: RatingRecord;
  if (existing) {
    existing.value = value;
    if (existing.save) {
      await existing.save();
    }
    record = existing;
  } else {
    // Unique (recipe, user) index guarantees one active rating per user per recipe.
    record = (await RatingModel.create({ recipe: recipeId, user: user.id, value })) as RatingRecord;
  }

  const summary = await recomputeRatingAggregates(recipeId);

  res.status(200).json({
    rating: toRatingResponse(record, recipeId, user.id),
    summary,
  });
});

/** DELETE /recipes/:id/ratings — remove own rating (FR-RATE-03). */
export const removeRating = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const recipeId = parseIdParam(req.params.id, "id");

  await requirePublishedRecipe(recipeId);
  await RatingModel.findOneAndDelete({ recipe: recipeId, user: user.id });
  await recomputeRatingAggregates(recipeId);

  res.status(200).json({ success: true });
});

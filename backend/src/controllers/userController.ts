import { Router } from "express";
import { Types } from "mongoose";
import { authenticate, requireUser } from "../middleware/auth.js";
import { RecipeModel } from "../models/Recipe.js";
import { UserModel } from "../models/User.js";
import { UpdateProfileInput } from "../types/index.js";
import { ApiError } from "../utils/ApiError.js";

export const userRouter = Router();

// All /users routes require authentication
userRouter.use(authenticate);

interface UserDocument {
  _id: unknown;
  name: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string;
  role: "user" | "admin";
  preferences?: {
    dietaryLabels?: string[];
    allergies?: string[];
    dislikedIngredients?: string[];
    calorieTarget?: number | null;
    calorieRange?: { min?: number | null; max?: number | null } | null;
    proteinTargetGrams?: number | null;
    cookingTimeMaxMinutes?: number | null;
    difficulty?: "easy" | "medium" | "hard" | null;
  };
  createdAt: Date | string;
  updatedAt: Date | string;
}

function formatUserProfile(user: UserDocument) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? "",
    role: user.role,
    preferences: {
      dietaryLabels: user.preferences?.dietaryLabels ?? [],
      allergies: user.preferences?.allergies ?? [],
      dislikedIngredients: user.preferences?.dislikedIngredients ?? [],
      calorieTarget: user.preferences?.calorieTarget ?? null,
      calorieRange: user.preferences?.calorieRange
        ? {
            min: user.preferences.calorieRange.min ?? null,
            max: user.preferences.calorieRange.max ?? null,
          }
        : null,
      proteinTargetGrams: user.preferences?.proteinTargetGrams ?? null,
      cookingTimeMaxMinutes: user.preferences?.cookingTimeMaxMinutes ?? null,
      difficulty: user.preferences?.difficulty ?? null,
    },
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt,
  };
}

/**
 * GET /users/me — returns current authenticated user's profile and preferences (FR-AUTH-06)
 */
userRouter.get("/me", async (req, res, next) => {
  try {
    const authUser = requireUser(req);
    const user = (await UserModel.findById(authUser.id).lean().exec()) as UserDocument | null;

    if (!user) {
      throw new ApiError(404, "NOT_FOUND", "User profile not found.");
    }

    res.status(200).json(formatUserProfile(user));
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /users/me — updates current user's profile and preferences (FR-AUTH-06)
 */
userRouter.patch("/me", async (req, res, next) => {
  try {
    const authUser = requireUser(req);
    const input = UpdateProfileInput.parse(req.body);

    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.avatarUrl !== undefined) update.avatarUrl = input.avatarUrl;
    if (input.bio !== undefined) update.bio = input.bio;
    if (input.preferences !== undefined) {
      update.preferences = input.preferences;
    }

    const updatedUser = (await UserModel.findByIdAndUpdate(
      authUser.id,
      { $set: update },
      { new: true, runValidators: true },
    )
      .lean()
      .exec()) as UserDocument | null;

    if (!updatedUser) {
      throw new ApiError(404, "NOT_FOUND", "User profile not found.");
    }

    res.status(200).json(formatUserProfile(updatedUser));
  } catch (err) {
    next(err);
  }
});

interface RecipeStatsAggregate {
  _id: null;
  totalRecipes: number;
  draftCount: number;
  publishedCount: number;
  hiddenCount: number;
  totalRatingsReceived: number;
  totalFavoritesReceived: number;
  totalCommentsReceived: number;
  weightedRatingSum: number;
}

/**
 * GET /users/me/stats — additive (post-freeze), not in the originally frozen
 * contract. Powers the frontend dashboard's stat cards: counts by recipe
 * status, plus aggregate ratings/favorites/comments received across every
 * recipe the caller owns.
 */
userRouter.get("/me/stats", async (req, res, next) => {
  try {
    const authUser = requireUser(req);

    const [stats] = (await RecipeModel.aggregate([
      { $match: { owner: new Types.ObjectId(authUser.id) } },
      {
        $group: {
          _id: null,
          totalRecipes: { $sum: 1 },
          draftCount: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } },
          publishedCount: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } },
          hiddenCount: { $sum: { $cond: [{ $eq: ["$status", "hidden"] }, 1, 0] } },
          totalRatingsReceived: { $sum: "$ratingCount" },
          totalFavoritesReceived: { $sum: "$favoriteCount" },
          totalCommentsReceived: { $sum: "$commentCount" },
          weightedRatingSum: { $sum: { $multiply: ["$averageRating", "$ratingCount"] } },
        },
      },
    ])) as RecipeStatsAggregate[];

    const totalRatingsReceived = stats?.totalRatingsReceived ?? 0;
    const averageRating =
      totalRatingsReceived > 0
        ? Math.round(((stats?.weightedRatingSum ?? 0) / totalRatingsReceived) * 100) / 100
        : 0;

    res.status(200).json({
      totalRecipes: stats?.totalRecipes ?? 0,
      draftCount: stats?.draftCount ?? 0,
      publishedCount: stats?.publishedCount ?? 0,
      hiddenCount: stats?.hiddenCount ?? 0,
      totalRatingsReceived,
      totalFavoritesReceived: stats?.totalFavoritesReceived ?? 0,
      totalCommentsReceived: stats?.totalCommentsReceived ?? 0,
      averageRating,
    });
  } catch (err) {
    next(err);
  }
});

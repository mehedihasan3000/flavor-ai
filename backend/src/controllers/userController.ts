import { Router } from "express";
import { authenticate, requireUser } from "../middleware/auth.js";
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

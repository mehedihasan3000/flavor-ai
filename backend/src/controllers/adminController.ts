import type { Request, Response } from "express";
import { recomputeCommentCount, type CommentRecord } from "./commentController.js";
import { CommentModel } from "../models/Comment.js";
import { FavoriteModel } from "../models/Favorite.js";
import { RatingModel } from "../models/Rating.js";
import { RecipeModel } from "../models/Recipe.js";
import { UserModel } from "../models/User.js";
import type { AuthUser } from "../types/auth.js";
import {
  AdminCommentModerationInput,
  AdminCommentSearchQuery,
  AdminRecipeModerationInput,
  AdminRecipeSearchQuery,
  AdminUserSearchQuery,
} from "../types/index.js";
import { ApiError } from "../utils/ApiError.js";
import { logAdminAction } from "../utils/adminLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseIdParam } from "../utils/params.js";
import { escapeRegExp } from "../utils/regex.js";

type UserRecord = {
  _id: unknown;
  name: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string;
  role: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type RecipeRecord = {
  _id: unknown;
  title: string;
  slug: string;
  owner: unknown;
  status: string;
  averageRating?: number;
  ratingCount?: number;
  favoriteCount?: number;
  commentCount?: number;
  publishedAt?: Date | null;
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

function toIso(value?: Date | null): string {
  return (value ?? new Date()).toISOString();
}

function toAdminUserResponse(doc: UserRecord) {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    avatarUrl: doc.avatarUrl ?? null,
    bio: doc.bio ?? "",
    role: doc.role,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

function toAdminRecipeResponse(doc: RecipeRecord) {
  return {
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    owner: String(doc.owner),
    status: doc.status,
    averageRating: doc.averageRating ?? 0,
    ratingCount: doc.ratingCount ?? 0,
    favoriteCount: doc.favoriteCount ?? 0,
    commentCount: doc.commentCount ?? 0,
    publishedAt: doc.publishedAt ? toIso(doc.publishedAt) : null,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

function toAdminCommentResponse(doc: CommentRecord) {
  return {
    id: String(doc._id),
    recipe: String(doc.recipe),
    user: String(doc.user),
    body: doc.body,
    moderationStatus: doc.moderationStatus,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

/** GET /admin/users — list/search users (FR-ADMIN-01). */
export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, q, role } = AdminUserSearchQuery.parse(req.query);

  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (q) {
    const pattern = new RegExp(escapeRegExp(q), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [docs, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    UserModel.countDocuments(filter),
  ]);

  res.json({
    items: (docs as unknown as UserRecord[]).map(toAdminUserResponse),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

/** GET /admin/recipes — list all recipes incl. draft/hidden (FR-ADMIN-01). */
export const listAdminRecipes = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, q, status } = AdminRecipeSearchQuery.parse(req.query);

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (q) filter.title = new RegExp(escapeRegExp(q), "i");

  const [docs, total] = await Promise.all([
    RecipeModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    RecipeModel.countDocuments(filter),
  ]);

  res.json({
    items: (docs as unknown as RecipeRecord[]).map(toAdminRecipeResponse),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

/**
 * PATCH /admin/recipes/:id — hide or restore a recipe (FR-ADMIN-02). Scoped
 * to published <-> hidden only; draft/publish stays the owner's workflow (M3).
 */
export const moderateRecipe = asyncHandler(async (req: Request, res: Response) => {
  const admin = currentUser(req);
  const recipeId = parseIdParam(req.params.id, "id");
  const { status } = AdminRecipeModerationInput.parse(req.body);

  const recipe = (await RecipeModel.findById(recipeId)) as RecipeRecord | null;
  if (!recipe) {
    throw new ApiError(404, "NOT_FOUND", "Recipe not found.");
  }

  // Moderation only toggles published <-> hidden; a draft (never published by
  // its owner) is out of scope and must not be reachable via this endpoint.
  if (recipe.status !== "published" && recipe.status !== "hidden") {
    throw new ApiError(
      409,
      "CONFLICT",
      "Only published or hidden recipes can be moderated.",
    );
  }

  recipe.status = status;
  if (status === "published" && !recipe.publishedAt) {
    recipe.publishedAt = new Date();
  }
  if (recipe.save) {
    await recipe.save();
  }

  logAdminAction({
    actorId: admin.id,
    action: status === "hidden" ? "hide_recipe" : "restore_recipe",
    targetType: "recipe",
    targetId: recipeId,
  });

  res.status(200).json({ recipe: toAdminRecipeResponse(recipe) });
});

/** DELETE /admin/recipes/:id — delete a recipe (FR-ADMIN-02). */
export const deleteRecipeAdmin = asyncHandler(async (req: Request, res: Response) => {
  const admin = currentUser(req);
  const recipeId = parseIdParam(req.params.id, "id");

  const deleted = await RecipeModel.findByIdAndDelete(recipeId);
  if (!deleted) {
    throw new ApiError(404, "NOT_FOUND", "Recipe not found.");
  }

  // Cascade: a deleted recipe must not leave orphaned ratings/comments/favorites behind.
  await Promise.all([
    RatingModel.deleteMany({ recipe: recipeId }),
    CommentModel.deleteMany({ recipe: recipeId }),
    FavoriteModel.deleteMany({ recipe: recipeId }),
  ]);

  logAdminAction({
    actorId: admin.id,
    action: "delete_recipe",
    targetType: "recipe",
    targetId: recipeId,
  });

  res.status(200).json({ success: true });
});

/** GET /admin/comments — list comments incl. moderated (FR-ADMIN-01). */
export const listAdminComments = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, recipeId, moderationStatus } = AdminCommentSearchQuery.parse(req.query);

  const filter: Record<string, unknown> = {};
  if (recipeId) filter.recipe = recipeId;
  if (moderationStatus) filter.moderationStatus = moderationStatus;

  const [docs, total] = await Promise.all([
    CommentModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CommentModel.countDocuments(filter),
  ]);

  res.json({
    items: (docs as unknown as CommentRecord[]).map(toAdminCommentResponse),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

/** PATCH /admin/comments/:id — moderate/unmoderate a comment (FR-ADMIN-02). */
export const moderateComment = asyncHandler(async (req: Request, res: Response) => {
  const admin = currentUser(req);
  const commentId = parseIdParam(req.params.id, "id");
  const { moderationStatus } = AdminCommentModerationInput.parse(req.body);

  const comment = (await CommentModel.findById(commentId)) as CommentRecord | null;
  if (!comment) {
    throw new ApiError(404, "NOT_FOUND", "Comment not found.");
  }

  comment.moderationStatus = moderationStatus;
  if (comment.save) {
    await comment.save();
  }
  await recomputeCommentCount(String(comment.recipe));

  logAdminAction({
    actorId: admin.id,
    action: moderationStatus === "moderated" ? "moderate_comment" : "unmoderate_comment",
    targetType: "comment",
    targetId: commentId,
  });

  res.status(200).json({ comment: toAdminCommentResponse(comment) });
});

/** DELETE /admin/comments/:id — delete a comment (FR-ADMIN-02). */
export const deleteCommentAdmin = asyncHandler(async (req: Request, res: Response) => {
  const admin = currentUser(req);
  const commentId = parseIdParam(req.params.id, "id");

  const deleted = (await CommentModel.findByIdAndDelete(commentId)) as CommentRecord | null;
  if (!deleted) {
    throw new ApiError(404, "NOT_FOUND", "Comment not found.");
  }
  await recomputeCommentCount(String(deleted.recipe));

  logAdminAction({
    actorId: admin.id,
    action: "delete_comment",
    targetType: "comment",
    targetId: commentId,
  });

  res.status(200).json({ success: true });
});

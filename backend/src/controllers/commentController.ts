import type { Request, Response } from "express";
import { CommentModel } from "../models/Comment.js";
import { RecipeModel } from "../models/Recipe.js";
import type { AuthUser } from "../types/auth.js";
import { CreateCommentInput, PaginationQuery, UpdateCommentInput } from "../types/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseIdParam } from "../utils/params.js";
import { requirePublishedRecipe } from "../utils/recipeAccess.js";
import { sanitizePlainText } from "../utils/sanitize.js";

export type CommentRecord = {
  _id: unknown;
  recipe: unknown;
  user: unknown;
  body: string;
  moderationStatus: string;
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

/**
 * Strips markup from `body` before schema validation (FR-COMMENT-04, NFR-SEC-06).
 * Non-string/missing `body` passes through untouched so Zod reports the
 * expected "required"/"invalid type" validation error instead of this
 * sanitizer masking it.
 */
function sanitizeBodyField(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const body = (raw as Record<string, unknown>).body;
  return { ...raw, body: typeof body === "string" ? sanitizePlainText(body) : body };
}

/**
 * Recomputes the recipe's visible comment count after any comment change
 * (create/delete/moderate) so `Recipe.commentCount` never drifts. Exported
 * for `adminController.ts` to reuse after moderate/unmoderate/delete actions.
 */
export async function recomputeCommentCount(recipeId: string): Promise<number> {
  const commentCount = await CommentModel.countDocuments({
    recipe: recipeId,
    moderationStatus: "visible",
  });
  await RecipeModel.updateOne({ _id: recipeId }, { $set: { commentCount } });
  return commentCount;
}

function toCommentResponse(record: CommentRecord, recipeId: string) {
  return {
    id: String(record._id),
    recipe: recipeId,
    user: String(record.user),
    body: record.body,
    moderationStatus: record.moderationStatus,
    createdAt: (record.createdAt ?? new Date()).toISOString(),
    updatedAt: (record.updatedAt ?? new Date()).toISOString(),
  };
}

/** GET /recipes/:id/comments — public, paginated, visible-only list (FR-COMMENT-05). */
export const listComments = asyncHandler(async (req: Request, res: Response) => {
  const recipeId = parseIdParam(req.params.id, "id");
  await requirePublishedRecipe(recipeId);
  const { page, limit } = PaginationQuery.parse(req.query);

  const filter = { recipe: recipeId, moderationStatus: "visible" };
  const [docs, total] = await Promise.all([
    CommentModel.find(filter)
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CommentModel.countDocuments(filter),
  ]);

  res.json({
    items: (docs as unknown as CommentRecord[]).map((doc) => toCommentResponse(doc, recipeId)),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

/** POST /recipes/:id/comments — add a comment on a published recipe (FR-COMMENT-01/04). */
export const createComment = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const recipeId = parseIdParam(req.params.id, "id");
  await requirePublishedRecipe(recipeId);
  const { body } = CreateCommentInput.parse(sanitizeBodyField(req.body));

  const record = (await CommentModel.create({
    recipe: recipeId,
    user: user.id,
    body,
  })) as CommentRecord;

  await recomputeCommentCount(recipeId);

  res.status(201).json({ comment: toCommentResponse(record, recipeId) });
});

/** PATCH /comments/:id — edit own comment (FR-COMMENT-02). */
export const updateComment = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const commentId = parseIdParam(req.params.id, "id");
  const { body } = UpdateCommentInput.parse(sanitizeBodyField(req.body));

  const record = (await CommentModel.findById(commentId)) as CommentRecord | null;
  if (!record) {
    throw new ApiError(404, "NOT_FOUND", "Comment not found.");
  }
  if (String(record.user) !== user.id) {
    throw new ApiError(403, "FORBIDDEN", "You can only edit your own comments.");
  }

  record.body = body;
  if (record.save) {
    await record.save();
  }

  res.status(200).json({ comment: toCommentResponse(record, String(record.recipe)) });
});

/** DELETE /comments/:id — author or admin deletes a comment (FR-COMMENT-02/03). */
export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const commentId = parseIdParam(req.params.id, "id");

  const record = (await CommentModel.findById(commentId)) as CommentRecord | null;
  if (!record) {
    throw new ApiError(404, "NOT_FOUND", "Comment not found.");
  }
  if (String(record.user) !== user.id && user.role !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "You can only delete your own comments.");
  }

  const recipeId = String(record.recipe);
  await CommentModel.findByIdAndDelete(commentId);
  await recomputeCommentCount(recipeId);

  res.status(200).json({ success: true });
});

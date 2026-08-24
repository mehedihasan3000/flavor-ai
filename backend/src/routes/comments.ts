import { Router } from "express";
import { createComment, listComments } from "../controllers/commentController.js";
import { requireAuth } from "../middleware/auth.js";
import { commentLimiter } from "../middleware/rateLimit.js";

// mergeParams exposes the parent's `:id` from /recipes/:id/comments.
export const commentsRouter = Router({ mergeParams: true });

commentsRouter.get("/", listComments);
commentsRouter.post("/", commentLimiter, requireAuth, createComment);

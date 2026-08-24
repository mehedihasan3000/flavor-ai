import { Router } from "express";
import { deleteComment, updateComment } from "../controllers/commentController.js";
import { requireAuth } from "../middleware/auth.js";
import { commentLimiter } from "../middleware/rateLimit.js";

// Top-level /comments/:id — ownership (or admin, for delete) is enforced
// inside the controller since a single route serves both roles.
export const commentDetailRouter = Router();

commentDetailRouter.patch("/:id", commentLimiter, requireAuth, updateComment);
commentDetailRouter.delete("/:id", commentLimiter, requireAuth, deleteComment);

import { Router } from "express";
import {
  getRatingSummary,
  removeRating,
  upsertRating,
} from "../controllers/ratingController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

// mergeParams exposes the parent's `:id` from /recipes/:id/ratings.
export const ratingsRouter = Router({ mergeParams: true });

// optionalAuth: still public, but hydrates req.user when a valid token is
// sent so the summary can include the caller's own rating (myRating).
ratingsRouter.get("/", optionalAuth, getRatingSummary);
ratingsRouter.put("/", requireAuth, upsertRating);
ratingsRouter.delete("/", requireAuth, removeRating);
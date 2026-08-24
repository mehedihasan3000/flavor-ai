import { Router } from "express";
import {
  getRatingSummary,
  removeRating,
  upsertRating,
} from "../controllers/ratingController.js";
import { requireAuth } from "../middleware/auth.js";

// mergeParams exposes the parent's `:id` from /recipes/:id/ratings.
export const ratingsRouter = Router({ mergeParams: true });

ratingsRouter.get("/", getRatingSummary);
ratingsRouter.put("/", requireAuth, upsertRating);
ratingsRouter.delete("/", requireAuth, removeRating);
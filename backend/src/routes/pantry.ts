import { Router } from "express";
import {
  createItem,
  deleteItem,
  expiringSoon,
  listItems,
  updateItem,
  useItem,
} from "../controllers/pantryController.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import {
  CreatePantryItemInput,
  PaginationQuery,
  PantrySearchQuery,
  UpdatePantryItemInput,
  UsePantryItemInput,
} from "../types/index.js";

/**
 * Pantry routes — owned by Dev A (Workstream A, FEATURES_TASKS.md §1.2, §A2).
 * Every route requires auth; bodies/queries validated by Zod before reaching
 * the controller. `:id` params are validated in-controller via
 * `parseIdParam` (400 on malformed — same as comments/favorites/admin;
 * there is no `validateParams` middleware in the codebase).
 *
 * Mounted by the Lead in `v1.ts` (shared file — do NOT mount here).
 */
export const pantryRouter = Router();

pantryRouter.get(
  "/items",
  requireAuth,
  validateQuery(PantrySearchQuery),
  listItems,
);
pantryRouter.post(
  "/items",
  requireAuth,
  validateBody(CreatePantryItemInput),
  createItem,
);
pantryRouter.patch(
  "/items/:id",
  requireAuth,
  validateBody(UpdatePantryItemInput),
  updateItem,
);
pantryRouter.delete("/items/:id", requireAuth, deleteItem);
pantryRouter.post(
  "/items/:id/use",
  requireAuth,
  validateBody(UsePantryItemInput),
  useItem,
);
pantryRouter.get(
  "/expiring",
  requireAuth,
  validateQuery(PaginationQuery),
  expiringSoon,
);

import { Router } from "express";
import {
  addManualItem,
  clearPurchased,
  deleteItem,
  generateFromMealPlan,
  getGroceryList,
  listGroceryLists,
  purchasedToPantry,
  recalculate,
  updateItem,
  updateList,
} from "../controllers/groceryController.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import {
  AddGroceryItemInput,
  GenerateGroceryInput,
  PaginationQuery,
  PurchasedToPantryInput,
  UpdateGroceryItemInput,
  UpdateGroceryListInput,
} from "../types/index.js";

/**
 * GroceryList routes — owned by Dev C (Workstream C, FEATURES_TASKS.md §1.2, §C2).
 * Every route requires auth; bodies/queries validated by Zod before reaching
 * the controller. `:id` and `:itemId` params are validated in-controller via
 * `parseIdParam` (400 on malformed — same as pantry/comments/admin).
 *
 * Mounted by the Lead in `v1.ts` (shared file — do NOT mount here).
 */
export const groceryListsRouter = Router();

groceryListsRouter.get(
  "/",
  requireAuth,
  validateQuery(PaginationQuery),
  listGroceryLists,
);

groceryListsRouter.post(
  "/generate",
  requireAuth,
  validateBody(GenerateGroceryInput),
  generateFromMealPlan,
);

groceryListsRouter.get("/:id", requireAuth, getGroceryList);

groceryListsRouter.patch(
  "/:id",
  requireAuth,
  validateBody(UpdateGroceryListInput),
  updateList,
);

groceryListsRouter.post(
  "/:id/items",
  requireAuth,
  validateBody(AddGroceryItemInput),
  addManualItem,
);

groceryListsRouter.patch(
  "/:id/items/:itemId",
  requireAuth,
  validateBody(UpdateGroceryItemInput),
  updateItem,
);

groceryListsRouter.delete("/:id/items/:itemId", requireAuth, deleteItem);

groceryListsRouter.post("/:id/clear-purchased", requireAuth, clearPurchased);

groceryListsRouter.post("/:id/recalculate", requireAuth, recalculate);

groceryListsRouter.post(
  "/:id/purchased-to-pantry",
  requireAuth,
  validateBody(PurchasedToPantryInput),
  purchasedToPantry,
);

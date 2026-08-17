import { Router } from "express";
import * as recipeController from "../controllers/recipeController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { CreateRecipeInput, UpdateRecipeInput } from "../types/index.js";

export const recipesRouter = Router();

// GET /recipes (paginated search) is added in M3 step 2.

recipesRouter.get("/:id", optionalAuth, recipeController.getRecipe);
recipesRouter.post(
  "/",
  requireAuth,
  validateBody(CreateRecipeInput),
  recipeController.createRecipe,
);
recipesRouter.patch(
  "/:id",
  requireAuth,
  validateBody(UpdateRecipeInput),
  recipeController.updateRecipe,
);
recipesRouter.delete("/:id", requireAuth, recipeController.deleteRecipe);
recipesRouter.post("/:id/publish", requireAuth, recipeController.publishRecipe);
recipesRouter.post("/:id/unpublish", requireAuth, recipeController.unpublishRecipe);

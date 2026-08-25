import { Router } from "express";
import * as recipeController from "../controllers/recipeController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { CreateRecipeInput, RecipeSearchQuery, UpdateRecipeInput } from "../types/index.js";

export const recipesRouter = Router();

recipesRouter.get(
  "/",
  optionalAuth,
  validateQuery(RecipeSearchQuery),
  recipeController.searchRecipes,
);
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

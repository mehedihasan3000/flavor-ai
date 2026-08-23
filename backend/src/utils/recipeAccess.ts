import { RecipeModel } from "../models/Recipe.js";
import { ApiError } from "./ApiError.js";

/** Minimal published-recipe projection used by community interactions. */
export interface PublicRecipe {
  _id: unknown;
  owner: unknown;
  status: string;
  averageRating: number;
  ratingCount: number;
}

/**
 * Resolves a recipe for a public interaction (ratings/comments/favorites).
 * Drafts and hidden recipes are never exposed here (Business Rules 3/4/10).
 */
export async function requirePublishedRecipe(recipeId: string): Promise<PublicRecipe> {
  const recipe = (await RecipeModel.findById(recipeId).lean()) as PublicRecipe | null;
  if (!recipe || recipe.status !== "published") {
    throw new ApiError(404, "NOT_FOUND", "Recipe not found.");
  }
  return recipe;
}
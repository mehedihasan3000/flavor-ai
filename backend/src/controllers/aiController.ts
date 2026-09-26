import type { Request, Response } from "express";
import {
  analyzeFoodPhoto,
  generateAIRecipe,
  generateFlavorPairings,
  matchRecipesToTaste,
} from "../services/aiService.js";
import {
  AIRecipePromptInput,
  FlavorPairingInput,
  FoodPhotoAnalysisInput,
  TasteMatchInput,
} from "../types/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Generates an AI recipe based on pantry ingredients and preferences.
 * POST /api/v1/ai/recipes/generate (Protected)
 */
export const generateRecipe = asyncHandler(async (req: Request, res: Response) => {
  const validatedInput = AIRecipePromptInput.parse(req.body);
  const userId = req.user?.id;

  const result = await generateAIRecipe(validatedInput, userId);

  res.status(200).json(result);
});

/**
 * Generates flavor pairing suggestions for a given ingredient.
 * POST /api/v1/ai/flavor-pairings (Protected)
 */
export const suggestFlavorPairings = asyncHandler(async (req: Request, res: Response) => {
  const validatedInput = FlavorPairingInput.parse(req.body);
  const userId = req.user?.id;

  const result = await generateFlavorPairings(validatedInput, userId);

  res.status(200).json(result);
});

/**
 * Analyzes a food photo to estimate nutrition and detect ingredients.
 * POST /api/v1/ai/nutrition/analyze-photo (Protected)
 */
export const analyzePhotoNutrition = asyncHandler(async (req: Request, res: Response) => {
  const validatedInput = FoodPhotoAnalysisInput.parse(req.body);
  const userId = req.user?.id;

  const result = await analyzeFoodPhoto(validatedInput, userId);

  res.status(200).json(result);
});

/**
 * Recommends existing published recipes matching the caller's taste preferences.
 * POST /api/v1/ai/recipes/taste-match (Protected)
 */
export const matchTasteToRecipes = asyncHandler(async (req: Request, res: Response) => {
  const validatedInput = TasteMatchInput.parse(req.body);
  const userId = req.user?.id;

  const result = await matchRecipesToTaste(validatedInput, userId);

  res.status(200).json(result);
});

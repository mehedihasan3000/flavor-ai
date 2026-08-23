import type { Request, Response } from "express";
import { generateAIRecipe, generateFlavorPairings } from "../services/aiService.js";
import { AIRecipePromptInput, FlavorPairingInput } from "../types/index.js";
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

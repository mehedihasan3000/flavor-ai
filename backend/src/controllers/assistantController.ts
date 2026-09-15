import type { Request, Response } from "express";
import {
  adjustAssistantMacros,
  chatWithAssistant,
  recommendAssistantRecipes,
  suggestPantryRecipes,
} from "../services/assistantService.js";
import {
  AssistantChatInput,
  AssistantRecommendationInput,
  MacroAdjustmentInput,
  PantrySuggestionsInput,
} from "../types/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireUser } from "../middleware/auth.js";

/**
 * Chat with the Food & Nutrition AI Assistant (user-scoped RAG).
 * POST /api/v1/assistant/chat (Protected)
 */
export const chat = asyncHandler(async (req: Request, res: Response) => {
  const validatedInput = AssistantChatInput.parse(req.body);
  const userId = requireUser(req).id;

  const result = await chatWithAssistant(validatedInput, userId);

  res.status(200).json(result);
});

/**
 * Recipe recommendations grounded in the user's context.
 * POST /api/v1/assistant/recommendations (Protected)
 */
export const recommend = asyncHandler(async (req: Request, res: Response) => {
  const validatedInput = AssistantRecommendationInput.parse(req.body);
  const userId = requireUser(req).id;

  const result = await recommendAssistantRecipes(validatedInput, userId);

  res.status(200).json(result);
});

/**
 * Pantry-based recipe suggestions (DB-first matching, AI ranking).
 * POST /api/v1/assistant/pantry-suggestions (Protected)
 */
export const pantrySuggest = asyncHandler(async (req: Request, res: Response) => {
  const validatedInput = PantrySuggestionsInput.parse(req.body);
  const userId = requireUser(req).id;

  const result = await suggestPantryRecipes(validatedInput, userId);

  res.status(200).json(result);
});

/**
 * Macro adjustment suggestions (never overwrites stored plans).
 * POST /api/v1/assistant/macro-adjustments (Protected)
 */
export const macroAdjust = asyncHandler(async (req: Request, res: Response) => {
  const validatedInput = MacroAdjustmentInput.parse(req.body);
  const userId = requireUser(req).id;

  const result = await adjustAssistantMacros(validatedInput, userId);

  res.status(200).json(result);
});

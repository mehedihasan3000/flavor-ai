import { Router } from "express";
import { generateRecipe, suggestFlavorPairings } from "../controllers/aiController.js";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimiter } from "../middleware/rateLimiters.js";
import { validateBody } from "../middleware/validate.js";
import { AIRecipePromptInput, FlavorPairingInput } from "../types/index.js";

export const aiRouter = Router();

aiRouter.post(
  "/recipes/generate",
  requireAuth,
  aiRateLimiter,
  validateBody(AIRecipePromptInput),
  generateRecipe,
);

aiRouter.post(
  "/flavor-pairings",
  requireAuth,
  aiRateLimiter,
  validateBody(FlavorPairingInput),
  suggestFlavorPairings,
);

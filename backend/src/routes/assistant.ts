import { Router } from "express";
import {
  chat,
  macroAdjust,
  pantrySuggest,
  recommend,
} from "../controllers/assistantController.js";
import { requireAuth } from "../middleware/auth.js";
import { aiRateLimiter } from "../middleware/rateLimiters.js";
import { validateBody } from "../middleware/validate.js";
import {
  AssistantChatInput,
  AssistantRecommendationInput,
  MacroAdjustmentInput,
  PantrySuggestionsInput,
} from "../types/index.js";

export const assistantRouter = Router();

assistantRouter.post("/chat", requireAuth, aiRateLimiter, validateBody(AssistantChatInput), chat);

assistantRouter.post(
  "/recommendations",
  requireAuth,
  aiRateLimiter,
  validateBody(AssistantRecommendationInput),
  recommend,
);

assistantRouter.post(
  "/pantry-suggestions",
  requireAuth,
  aiRateLimiter,
  validateBody(PantrySuggestionsInput),
  pantrySuggest,
);

assistantRouter.post(
  "/macro-adjustments",
  requireAuth,
  aiRateLimiter,
  validateBody(MacroAdjustmentInput),
  macroAdjust,
);

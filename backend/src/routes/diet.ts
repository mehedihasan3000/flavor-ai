import { Router } from "express";
import { getDietPlan } from "../controllers/dietController.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { DietPlanInput } from "../types/index.js";

export const dietRouter = Router();

dietRouter.post("/plan", requireAuth, validateBody(DietPlanInput), getDietPlan);

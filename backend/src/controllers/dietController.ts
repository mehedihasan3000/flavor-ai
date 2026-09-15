import type { Request, Response } from "express";
import { calculateDietPlan } from "../services/dietService.js";
import { DietPlanInput, DietPlanResult } from "../types/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Calculates a personalized diet plan from body metrics.
 * POST /api/v1/diet/plan (Protected) — pure calculation, nothing is stored.
 * The output is re-validated against the contract so a formula edge case can
 * never leak a shape violation (e.g. negative calories) to the client.
 */
export const getDietPlan = asyncHandler(async (req: Request, res: Response) => {
  const validatedInput = DietPlanInput.parse(req.body);

  const result = DietPlanResult.parse(calculateDietPlan(validatedInput));

  res.status(200).json(result);
});

import { Router } from "express";
import { uploadImage } from "../controllers/uploadController.js";
import { requireAuth } from "../middleware/auth.js";
import { uploadRateLimiter } from "../middleware/rateLimiters.js";

export const uploadRouter = Router();

uploadRouter.post(
  "/image",
  requireAuth,
  uploadRateLimiter,
  uploadImage,
);

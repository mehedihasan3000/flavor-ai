import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError.js";

/**
 * Standard handler converting rate-limit exceeded responses into standardized ApiError envelopes.
 */
function createRateLimitHandler(message: string) {
  return () => {
    throw new ApiError(429, "RATE_LIMITED", message);
  };
}

/**
 * Rate limiter for AI endpoints (/api/v1/ai/*).
 * Limits to 10 requests per 15-minute window per IP. (NFR-SEC-07)
 */
export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler("AI generation request rate limit exceeded. Please try again later."),
});

/**
 * Rate limiter for image upload endpoints (/api/v1/upload/*).
 * Limits to 10 requests per 15-minute window per IP. (NFR-SEC-07)
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler("Image upload rate limit exceeded. Please try again later."),
});

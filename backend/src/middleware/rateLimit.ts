import rateLimit from "express-rate-limit";

/** App-wide base limiter. Tighter limits per-group are added by each workstream. */
export const baseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    status: 429,
    code: "RATE_LIMITED",
    safeMessage: "Too many requests. Please try again later.",
  },
});

/**
 * Tighter limiter for comment-mutating endpoints (POST/PATCH/DELETE) on top
 * of `baseLimiter`, so a single account/IP can't spam a comment thread
 * (NFR-SEC-07). Read (GET) is left to `baseLimiter` only — listing comments
 * isn't the abuse surface here. IP-keyed (default), matching `baseLimiter`;
 * it runs ahead of `requireAuth` on each route so unauthenticated spam is
 * also throttled before hitting the DB-backed auth check.
 */
export const commentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    status: 429,
    code: "RATE_LIMITED",
    safeMessage: "Too many comment actions. Please slow down.",
  },
});

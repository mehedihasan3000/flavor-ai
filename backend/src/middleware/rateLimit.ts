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

/** Tighter limiter for auth endpoints (NFR-SEC-07). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    status: 429,
    code: "RATE_LIMITED",
    safeMessage: "Too many auth requests. Please try again later.",
  },
});
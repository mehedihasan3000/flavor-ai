import type { AuthUser } from "../middleware/auth.js";

declare global {
  namespace Express {
    interface Request {
      /** Attached by `requireAuth` / `optionalAuth`; undefined on public routes. */
      user?: AuthUser;
    }
  }
}

export {};

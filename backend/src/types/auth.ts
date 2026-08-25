/**
 * Request-context user type + Express Request augmentation.
 * `req.user` is populated by `middleware/auth.ts` (requireAuth / requireAdmin).
 * `role` derives from `USER_ROLE` in `./index.ts` (frozen contract).
 */

import type { USER_ROLE } from "./index.js";

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  role: (typeof USER_ROLE)[number];
};

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}
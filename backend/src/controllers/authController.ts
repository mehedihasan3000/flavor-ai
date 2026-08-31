import { Router } from "express";
import {
  authenticate,
  extractBearerToken,
  verifyAccessToken,
  type UserRole,
} from "../middleware/auth.js";
import { UserModel } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";

interface VerifiedUserRecord {
  _id: unknown;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
}

export const authRouter = Router();

/**
 * POST /auth/token/verify — verifies a signed JWT and lazily upserts the user
 * (matched by `providerId`). Returns the authenticated user context.
 */
authRouter.post("/token/verify", async (req, res, next) => {
  try {
    const claims = verifyAccessToken(extractBearerToken(req));

    const user = (await UserModel.findOneAndUpdate(
      { providerId: claims.sub },
      {
        $setOnInsert: {
          providerId: claims.sub,
          email: claims.email,
          name: claims.name ?? "User",
          role: claims.role ?? "user",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
      .lean()
      .exec()) as VerifiedUserRecord | null;

    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "User account not found.");
    }

    res.status(200).json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: (user.avatarUrl as string | null) ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/logout — stateless JWT: revocation is client-side token discard.
 * Endpoint exists for contract compliance; returns 204.
 */
authRouter.post("/logout", authenticate, (_req, res) => {
  res.status(204).end();
});
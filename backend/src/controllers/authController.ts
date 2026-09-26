import { Router } from "express";
import {
  authenticate,
  extractBearerToken,
  verifyAccessToken,
  type UserRole,
} from "../middleware/auth.js";
import { UserModel } from "../models/User.js";
import { CredentialSignInInput, CredentialSignUpInput } from "../types/index.js";
import { ApiError } from "../utils/ApiError.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

interface VerifiedUserRecord {
  _id: unknown;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
  providerId?: string | null;
  passwordHash?: string | null;
}

export const authRouter = Router();

/**
 * Deterministic providerId derived from the normalized email.
 * MUST stay in sync with the frontend minting logic so Google and
 * email/password logins for the same address share one FlavorAI account.
 */
function providerIdForEmail(email: string): string {
  return `usr_${Buffer.from(email).toString("hex").slice(0, 24)}`;
}

function toAuthUserPayload(user: VerifiedUserRecord) {
  return {
    id: String(user._id),
    providerId: (user.providerId as string | null) ?? null,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: (user.avatarUrl as string | null) ?? null,
  };
}

/**
 * POST /auth/sign-up — create an email/password account (FR-AUTH-01/07).
 * 201 { user } on success. 409 CONFLICT if the email is already registered
 * with a password. Legacy/Google-only docs without a passwordHash can claim
 * the address by setting their first password here (upgrade path).
 */
authRouter.post("/sign-up", async (req, res, next) => {
  try {
    const input = CredentialSignUpInput.parse(req.body);
    const email = input.email;
    const name = input.name;

    const existing = (await UserModel.findOne({ email }).lean().exec()) as
      | VerifiedUserRecord
      | null;

    if (existing) {
      if (existing.passwordHash) {
        throw new ApiError(
          409,
          "CONFLICT",
          "An account with this email already exists. Please sign in instead.",
        );
      }
      // Upgrade path: address exists but has no password (legacy mock or
      // Google-only account). Claim it by setting the first password.
      // Reuse the stored providerId so existing JWTs/sessions keep working.
      const passwordHash = await hashPassword(input.password);
      const update: Record<string, unknown> = { passwordHash };
      if (!existing.providerId) update.providerId = providerIdForEmail(email);
      if (!existing.name || existing.name === "User") update.name = name;
      const upgraded = (await UserModel.findByIdAndUpdate(
        existing._id,
        { $set: update },
        { new: true },
      )
        .lean()
        .exec()) as VerifiedUserRecord | null;
      if (!upgraded) {
        throw new ApiError(401, "UNAUTHORIZED", "User account not found.");
      }
      res.status(200).json({ user: toAuthUserPayload(upgraded) });
      return;
    }

    const passwordHash = await hashPassword(input.password);
    const created = (await UserModel.create({
      email,
      name,
      passwordHash,
      providerId: providerIdForEmail(email),
      // Role is ALWAYS "user" here — never derived from the email address.
      // Admin promotion happens via seed/manual DB update only.
      role: "user",
    }).then((doc) => doc.toObject())) as unknown as VerifiedUserRecord;

    res.status(201).json({ user: toAuthUserPayload(created) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/sign-in — verify email/password credentials (FR-AUTH-02/07).
 * 200 { user } on success. 401 UNAUTHORIZED for unknown email, missing
 * password, or wrong password (generic message to avoid account enumeration).
 * NEVER creates a user and NEVER returns the password hash.
 */
authRouter.post("/sign-in", async (req, res, next) => {
  try {
    const input = CredentialSignInInput.parse(req.body);
    const email = input.email;

    const user = (await UserModel.findOne({ email }).lean().exec()) as
      | VerifiedUserRecord
      | null;

    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid email or password.");
    }
    if (!user.passwordHash) {
      throw new ApiError(
        401,
        "UNAUTHORIZED",
        "This account uses Google sign-in. Please continue with Google.",
      );
    }
    const ok = await verifyPassword(input.password, user.passwordHash);
    if (!ok) {
      throw new ApiError(401, "UNAUTHORIZED", "Invalid email or password.");
    }

    res.status(200).json({ user: toAuthUserPayload(user) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/token/verify — verifies a signed JWT and lazily upserts the user
 * (matched by `providerId`). Returns the authenticated user context.
 */
authRouter.post("/token/verify", async (req, res, next) => {
  try {
    const claims = verifyAccessToken(extractBearerToken(req));

    // Build $setOnInsert payload — include avatarUrl when provided (real Google login)
    const setOnInsert: Record<string, unknown> = {
      providerId: claims.sub,
      email: claims.email,
      name: claims.name ?? "User",
      role: claims.role ?? "user",
    };
    if (claims.avatarUrl) setOnInsert.avatarUrl = claims.avatarUrl;

    let user = (await UserModel.findOneAndUpdate(
      { providerId: claims.sub },
      { $setOnInsert: setOnInsert },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
      .lean()
      .exec()) as VerifiedUserRecord | null;

    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "User account not found.");
    }

    // If existing user had no avatar but Google just supplied one, enrich it (one-time)
    if (claims.avatarUrl && !user.avatarUrl) {
      const enriched = (await UserModel.findByIdAndUpdate(
        user._id,
        { $set: { avatarUrl: claims.avatarUrl } },
        { new: true },
      )
        .lean()
        .exec()) as VerifiedUserRecord | null;
      if (enriched) user = enriched;
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
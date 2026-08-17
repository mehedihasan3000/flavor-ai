import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.js";
import type { AuthUser } from "../types/auth.js";
import { ObjectIdString } from "../types/index.js";
import { ApiError } from "../utils/ApiError.js";

interface AuthUserDoc {
  _id: unknown;
  email: string;
  name: string;
  role: string;
}

function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return undefined;
  return token;
}

async function authenticate(req: Request): Promise<AuthUser> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
  }

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }) as jwt.JwtPayload;
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token.");
  }

  const userId = payload.sub;
  if (!userId || !ObjectIdString.safeParse(userId).success) {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token.");
  }

  const user = (await UserModel.findById(userId).lean()) as AuthUserDoc | null;
  if (!user) {
    throw new ApiError(401, "UNAUTHORIZED", "User no longer exists.");
  }

  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role === "admin" ? "admin" : "user",
  };
}

/**
 * Verifies the signed Bearer JWT (issuer/audience/expiry) and attaches the
 * fresh user context to `req.user`. Rejects missing, malformed, expired, or
 * unauthorized tokens with a 401 envelope (FR-AUTH-04/05).
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    req.user = await authenticate(req);
    next();
  } catch (err) {
    next(err);
  }
}

/** requireAuth + role check: non-admin users receive a 403 envelope. */
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await authenticate(req);
    if (user.role !== "admin") {
      throw new ApiError(403, "FORBIDDEN", "Admin access required.");
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
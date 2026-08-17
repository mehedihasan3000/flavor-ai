import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.js";
import { USER_ROLE } from "../types/index.js";
import { ApiError } from "../utils/ApiError.js";

export type UserRole = (typeof USER_ROLE)[number];

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
}

interface AccessTokenClaims {
  sub: string;
  email: string;
  name?: string;
  role?: UserRole;
}

interface UserRecord {
  _id: unknown;
  email: string;
  name?: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function extractBearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError(401, "UNAUTHORIZED", "Missing or invalid authorization header.");
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new ApiError(401, "UNAUTHORIZED", "Missing or invalid authorization header.");
  }
  return token;
}

/**
 * Verifies a signed access token against the shared secret, issuer, and audience.
 * Rejects expired, malformed, or unauthorized tokens with a 401 ApiError (FR-AUTH-04/05).
 */
export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      algorithms: ["HS256"],
    });

    if (typeof decoded === "string") {
      throw new Error("Unexpected string token payload.");
    }
    if (typeof decoded.sub !== "string" || typeof decoded.email !== "string") {
      throw new Error("Token is missing required claims.");
    }

    return {
      sub: decoded.sub,
      email: decoded.email,
      name: typeof decoded.name === "string" ? decoded.name : undefined,
      role: USER_ROLE.includes(decoded.role as UserRole) ? (decoded.role as UserRole) : "user",
    };
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token.");
  }
}

/**
 * Authenticates a request: verifies the Bearer JWT and hydrates `req.user`
 * from the database (matched via `providerId`, which stores the token subject).
 * Rejects missing/malformed/expired/unauthorized tokens and unknown users.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const claims = verifyAccessToken(extractBearerToken(req));
    const user = (await UserModel.findOne({ providerId: claims.sub })
      .lean()
      .exec()) as UserRecord | null;

    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "User account not found.");
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireUser(req: Request): AuthUser {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
  }
  return req.user;
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    try {
      const user = requireUser(req);
      if (!roles.includes(user.role)) {
        throw new ApiError(403, "FORBIDDEN", "Insufficient permissions.");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requireAdmin: RequestHandler = requireRole("admin");

/**
 * Ownership guard: true for the resource owner or any admin.
 * Use after loading the resource and hydrating `req.user` (FR-RECIPE-06).
 */
export function isOwnerOrAdmin(
  owner: string | { toString(): string } | null | undefined,
  user?: AuthUser,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!owner) return false;
  return String(owner) === user.id;
}
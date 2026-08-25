import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserModel } from "../models/User.js";
import type { AuthUser } from "../types/auth.js";
import { USER_ROLE } from "../types/index.js";
import { ApiError } from "../utils/ApiError.js";

export type { AuthUser };
export type UserRole = (typeof USER_ROLE)[number];

export interface AccessTokenClaims {
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

function extractOptionalBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
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
    if (typeof decoded.sub !== "string") {
      throw new Error("Token is missing required sub claim.");
    }

    return {
      sub: decoded.sub,
      email: typeof decoded.email === "string" ? decoded.email : "",
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

/**
 * Alias for authenticate used in various workstreams.
 */
export const requireAuth: RequestHandler = authenticate;

/**
 * Verifies token optionally without rejecting guests.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractOptionalBearerToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const claims = verifyAccessToken(token);
    const user = (await UserModel.findOne({ providerId: claims.sub })
      .lean()
      .exec()) as UserRecord | null;

    if (user) {
      req.user = {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
      };
    }
  } catch {
    // ignore on optional routes
  }
  next();
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

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.user) {
    // If authenticate was not run first, run it
    authenticate(req, res, (err) => {
      if (err) {
        next(err);
        return;
      }
      if (req.user?.role !== "admin") {
        next(new ApiError(403, "FORBIDDEN", "Admin access required."));
        return;
      }
      next();
    });
    return;
  }

  if (req.user.role !== "admin") {
    next(new ApiError(403, "FORBIDDEN", "Admin access required."));
    return;
  }
  next();
};

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

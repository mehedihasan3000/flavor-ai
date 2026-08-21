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
    req.user = await authenticate(req);
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
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export type AuthUserRole = "user" | "admin";

export interface AuthUser {
  id: string;
  role: AuthUserRole;
}

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

interface AuthTokenPayload extends jwt.JwtPayload {
  role?: AuthUserRole;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = BEARER_PATTERN.exec(header);
  return match ? match[1] : null;
}

function verifyAuthUser(token: string): AuthUser {
  let payload: AuthTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }) as AuthTokenPayload;
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token.");
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid token payload.");
  }
  return {
    id: payload.sub,
    role: payload.role === "admin" ? "admin" : "user",
  };
}

/**
 * M2+ M3 bridge: verifies the signed Bearer JWT and attaches `req.user`.
 * Expired, malformed, or missing tokens are rejected with 401 (FR-AUTH-04/05).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
  }
  req.user = verifyAuthUser(token);
  next();
}

/**
 * Verifies a token but never rejects — used on public routes where an
 * authenticated user gains access to their own drafts (guests get 404).
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    req.user = verifyAuthUser(token);
  } catch {
    // Invalid/expired token on a public route — treat as anonymous.
  }
  next();
}

/** Admin-only guard. Use after `requireAuth`. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "Admin access required.");
  }
  next();
}

/** FR-RECIPE-06: owner or admin may manage a resource (never UI-hiding only). */
export function isOwnerOrAdmin(ownerId: unknown, user: AuthUser | undefined): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.id === String(ownerId);
}

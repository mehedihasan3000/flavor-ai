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

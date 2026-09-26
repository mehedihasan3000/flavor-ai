import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import {
  authenticate,
  extractBearerToken,
  isOwnerOrAdmin,
  requireRole,
  verifyAccessToken,
  type AuthUser,
} from "../src/middleware/auth.js";
import { UserModel } from "../src/models/User.js";
import { ApiError } from "../src/utils/ApiError.js";

vi.mock("../src/models/User.js", () => ({
  UserModel: { findOne: vi.fn() },
}));

function signToken(
  payload: Record<string, unknown>,
  opts: jwt.SignOptions = {},
): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    ...opts,
  });
}

function mockRequest(overrides: Partial<Request> = {}): Request {
  return { headers: {}, ...overrides } as Request;
}

describe("extractBearerToken", () => {
  it("returns the token from a Bearer header", () => {
    const req = mockRequest({ headers: { authorization: "Bearer abc.def.ghi" } });
    expect(extractBearerToken(req)).toBe("abc.def.ghi");
  });

  it("rejects a missing header", () => {
    expect(() => extractBearerToken(mockRequest())).toThrowError(ApiError);
  });

  it("rejects a non-Bearer scheme", () => {
    const req = mockRequest({ headers: { authorization: "Basic xyz" } });
    expect(() => extractBearerToken(req)).toThrowError(ApiError);
  });
});

describe("verifyAccessToken", () => {
  it("returns claims for a valid token", () => {
    const token = signToken({ sub: "ba-123", email: "ada@example.com", name: "Ada", role: "user" });
    expect(verifyAccessToken(token)).toEqual({
      sub: "ba-123",
      email: "ada@example.com",
      name: "Ada",
      role: "user",
      avatarUrl: null,
    });
  });

  it("defaults role to user when the claim is missing", () => {
    const token = signToken({ sub: "ba-123", email: "ada@example.com" });
    expect(verifyAccessToken(token).role).toBe("user");
  });

  it("rejects a malformed token", () => {
    expect(() => verifyAccessToken("not-a-jwt")).toThrowError(ApiError);
  });

  it("rejects a token signed with a different secret", () => {
    const token = jwt.sign({ sub: "x", email: "a@b.c" }, "a-different-secret-value", {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    expect(() => verifyAccessToken(token)).toThrowError(ApiError);
  });

  it("rejects an expired token", () => {
    const token = signToken({ sub: "x", email: "a@b.c" }, { expiresIn: "-10s" });
    expect(() => verifyAccessToken(token)).toThrowError(ApiError);
  });

  it("rejects a token with the wrong issuer", () => {
    const token = jwt.sign({ sub: "x", email: "a@b.c" }, env.JWT_SECRET, {
      issuer: "someone-else",
      audience: env.JWT_AUDIENCE,
    });
    expect(() => verifyAccessToken(token)).toThrowError(ApiError);
  });

  it("rejects a token with the wrong audience", () => {
    const token = jwt.sign({ sub: "x", email: "a@b.c" }, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: "someone-else-api",
    });
    expect(() => verifyAccessToken(token)).toThrowError(ApiError);
  });
});

describe("authenticate", () => {
  const findOneMock = vi.mocked(UserModel.findOne);

  beforeEach(() => {
    findOneMock.mockReset();
  });

  it("attaches req.user from the database record", async () => {
    const token = signToken({ sub: "ba-123", email: "ada@example.com", role: "user" });
    const req = mockRequest({ headers: { authorization: `Bearer ${token}` } });
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    findOneMock.mockReturnValue({
      lean: () => ({
        exec: async () => ({
          _id: "507f1f77bcf86cd799439011",
          email: "ada@example.com",
          name: "Ada",
          role: "user",
        }),
      }),
    } as never);

    await authenticate(req, res, next);

    expect(findOneMock).toHaveBeenCalledWith({ providerId: "ba-123" });
    expect(req.user).toEqual({
      id: "507f1f77bcf86cd799439011",
      email: "ada@example.com",
      name: "Ada",
      role: "user",
    });
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a token whose user is not in the database", async () => {
    const token = signToken({ sub: "ba-999", email: "ghost@example.com" });
    const req = mockRequest({ headers: { authorization: `Bearer ${token}` } });
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    findOneMock.mockReturnValue({ lean: () => ({ exec: async () => null }) } as never);

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const err = next.mock.calls[0]?.[0] as ApiError;
    expect(err.status).toBe(401);
  });

  it("rejects a request without a token", async () => {
    const req = mockRequest();
    const res = {} as Response;
    const next = vi.fn() as unknown as NextFunction;

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const err = next.mock.calls[0]?.[0] as ApiError;
    expect(err.status).toBe(401);
  });
});

describe("requireRole", () => {
  it("passes when the role matches", () => {
    const middleware = requireRole("admin");
    const req = mockRequest();
    req.user = { id: "u1", email: "a@b.c", role: "admin" };
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a non-matching role with 403", () => {
    const middleware = requireRole("admin");
    const req = mockRequest();
    req.user = { id: "u1", email: "a@b.c", role: "user" };
    const next = vi.fn() as unknown as NextFunction;

    middleware(req, {} as Response, next);

    const err = next.mock.calls[0]?.[0] as ApiError;
    expect(err.status).toBe(403);
  });

  it("rejects an unauthenticated request with 401", () => {
    const middleware = requireRole("admin");
    const next = vi.fn() as unknown as NextFunction;

    middleware(mockRequest(), {} as Response, next);

    const err = next.mock.calls[0]?.[0] as ApiError;
    expect(err.status).toBe(401);
  });
});

describe("isOwnerOrAdmin", () => {
  const user: AuthUser = { id: "u1", email: "a@b.c", role: "user" };

  it("returns true for the owner", () => {
    expect(isOwnerOrAdmin("u1", user)).toBe(true);
  });

  it("returns false for a different user", () => {
    expect(isOwnerOrAdmin("other", user)).toBe(false);
  });

  it("returns false when there is no owner", () => {
    expect(isOwnerOrAdmin(null, user)).toBe(false);
  });

  it("returns true for an admin regardless of owner", () => {
    const admin: AuthUser = { id: "u2", email: "admin@b.c", role: "admin" };
    expect(isOwnerOrAdmin("someone-else", admin)).toBe(true);
  });

  it("returns false when unauthenticated", () => {
    expect(isOwnerOrAdmin("u1", undefined)).toBe(false);
  });
});
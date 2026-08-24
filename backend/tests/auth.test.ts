import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { requireAdmin, requireAuth } from "../src/middleware/auth.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { UserModel } from "../src/models/User.js";

vi.mock("../src/models/User.js", () => ({
  UserModel: { findById: vi.fn() },
}));

const USER_ID = "507f1f77bcf86cd799439011";

const findById = vi.mocked(UserModel.findById);

function buildApp() {
  const app = express();
  app.get("/protected", requireAuth, (_req, res) => {
    res.json({ ok: true, user: _req.user });
  });
  app.get("/admin", requireAdmin, (_req, res) => {
    res.json({ ok: true, user: _req.user });
  });
  app.use(errorHandler);
  return app;
}

function signToken(payload: Record<string, unknown>, overrides: jwt.SignOptions = {}): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: "15m",
    ...overrides,
  });
}

type MockUserDoc = { _id: string; name: string; email: string; role: string };

const mockUser = (overrides: Partial<MockUserDoc> = {}): MockUserDoc => ({
  _id: USER_ID,
  name: "Ada",
  email: "ada@example.com",
  role: "user",
  ...overrides,
});

function mockFindById(result: MockUserDoc | null): void {
  const lean = vi.fn().mockResolvedValue(result as never);
  findById.mockReturnValue({ lean } as never);
}

describe("auth middleware (FR-AUTH-04/05)", () => {
  const app = buildApp();

  beforeEach(() => {
    findById.mockReset();
    mockFindById(mockUser());
  });

  it("rejects a request without a token (401)", async () => {
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("rejects a malformed token (401)", async () => {
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer not-a-jwt");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("rejects a non-Bearer auth header (401)", async () => {
    const res = await request(app).get("/protected").set("Authorization", "Basic abc");
    expect(res.status).toBe(401);
  });

  it("rejects an expired token (401)", async () => {
    const token = signToken({ sub: USER_ID }, { expiresIn: "-1s" });
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("rejects a token signed with the wrong secret (401)", async () => {
    const token = jwt.sign({ sub: USER_ID }, "wrong-secret-at-least-16-chars", {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: "15m",
    });
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("rejects a token with a mismatched audience (401)", async () => {
    const token = jwt.sign({ sub: USER_ID }, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: "other-api",
      expiresIn: "15m",
    });
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("rejects a valid token when the user no longer exists (401)", async () => {
    mockFindById(null);
    const token = signToken({ sub: USER_ID });
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("rejects a valid token with a non-ObjectId sub (401, not 500)", async () => {
    const token = signToken({ sub: "better-auth-user-123" });
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
    expect(findById).not.toHaveBeenCalled();
  });

  it("attaches the user for a valid token (200)", async () => {
    const token = signToken({ sub: USER_ID });
    const res = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: USER_ID, email: "ada@example.com", role: "user" });
    expect(findById).toHaveBeenCalledWith(USER_ID);
  });

  it("forbids non-admin users on admin routes (403)", async () => {
    const token = signToken({ sub: USER_ID });
    const res = await request(app).get("/admin").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("allows admins on admin routes (200)", async () => {
    mockFindById(mockUser({ role: "admin" }));
    const token = signToken({ sub: USER_ID });
    const res = await request(app).get("/admin").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("admin");
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
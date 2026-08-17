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
  });
});
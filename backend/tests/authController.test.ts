import request from "supertest";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { UserModel } from "../src/models/User.js";
import { createApp } from "../src/server.js";

vi.mock("../src/models/User.js", () => ({
  UserModel: { findOne: vi.fn(), findOneAndUpdate: vi.fn() },
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

const app = createApp();

describe("POST /api/v1/auth/token/verify", () => {
  const findOneAndUpdateMock = vi.mocked(UserModel.findOneAndUpdate);

  beforeEach(() => {
    findOneAndUpdateMock.mockReset();
  });

  it("returns the user context and upserts on first verify", async () => {
    const token = signToken({ sub: "ba-123", email: "ada@example.com", name: "Ada" });
    findOneAndUpdateMock.mockReturnValue({
      lean: () => ({
        exec: async () => ({
          _id: "507f1f77bcf86cd799439011",
          email: "ada@example.com",
          name: "Ada",
          role: "user",
        }),
      }),
    } as never);

    const res = await request(app)
      .post("/api/v1/auth/token/verify")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: {
        id: "507f1f77bcf86cd799439011",
        name: "Ada",
        email: "ada@example.com",
        role: "user",
        avatarUrl: null,
      },
    });
    expect(findOneAndUpdateMock).toHaveBeenCalledWith(
      { providerId: "ba-123" },
      {
        $setOnInsert: {
          providerId: "ba-123",
          email: "ada@example.com",
          name: "Ada",
          role: "user",
          avatarUrl: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  });

  it("defaults the display name to 'User' when absent from the token", async () => {
    const token = signToken({ sub: "ba-123", email: "ada@example.com" });
    findOneAndUpdateMock.mockReturnValue({
      lean: () => ({
        exec: async () => ({
          _id: "507f1f77bcf86cd799439011",
          email: "ada@example.com",
          name: "User",
          role: "user",
        }),
      }),
    } as never);

    await request(app).post("/api/v1/auth/token/verify").set("Authorization", `Bearer ${token}`);

    const { $setOnInsert } = findOneAndUpdateMock.mock.calls[0]?.[1] as {
      $setOnInsert: { name: string };
    };
    expect($setOnInsert.name).toBe("User");
  });

  it("rejects a malformed token with 401", async () => {
    const res = await request(app)
      .post("/api/v1/auth/token/verify")
      .set("Authorization", "Bearer not-a-jwt");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a missing authorization header with 401", async () => {
    const res = await request(app).post("/api/v1/auth/token/verify");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("POST /api/v1/auth/logout", () => {
  const findOneMock = vi.mocked(UserModel.findOne);

  beforeEach(() => {
    findOneMock.mockReset();
  });

  it("returns 204 for an authenticated user", async () => {
    const token = signToken({ sub: "ba-123", email: "ada@example.com" });
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

    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  it("rejects a request without a token with 401", async () => {
    const res = await request(app).post("/api/v1/auth/logout");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects a malformed token with 401", async () => {
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", "Bearer not-a-jwt");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "UNAUTHORIZED" });
  });
});
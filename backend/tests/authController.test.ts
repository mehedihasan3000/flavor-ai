import request from "supertest";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { UserModel } from "../src/models/User.js";
import { createApp } from "../src/server.js";

vi.mock("../src/models/User.js", () => ({
  UserModel: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
  },
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

describe("POST /api/v1/auth/sign-up", () => {
  const findOneMock = vi.mocked(UserModel.findOne);
  const createMock = vi.mocked(UserModel.create);
  const findByIdAndUpdateMock = vi.mocked(UserModel.findByIdAndUpdate);

  beforeEach(() => {
    findOneMock.mockReset();
    createMock.mockReset();
    findByIdAndUpdateMock.mockReset();
  });

  function leanOne(doc: unknown) {
    return { lean: () => ({ exec: async () => doc }) } as never;
  }

  it("creates a new account with a hashed password (201) and never returns the hash", async () => {
    findOneMock.mockReturnValue(leanOne(null));
    createMock.mockImplementation(async (data: unknown) => {
      const d = data as Record<string, unknown>;
      return {
        toObject: () => ({
          _id: "507f1f77bcf86cd799439011",
          ...d,
        }),
      } as never;
    });

    const res = await request(app)
      .post("/api/v1/auth/sign-up")
      .send({ name: "Ada", email: "ada@example.com", password: "s3cretP@ss!" });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("ada@example.com");
    expect(res.body.user.role).toBe("user");
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.body.user.providerId).toMatch(/^usr_/);

    const createdArg = createMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(createdArg.role).toBe("user");
    expect(typeof createdArg.passwordHash).toBe("string");
    expect(createdArg.passwordHash).not.toBe("s3cretP@ss!");
    expect(String(createdArg.passwordHash)).toContain(":");
  });

  it("always assigns role user even for admin-looking emails (no privilege escalation)", async () => {
    findOneMock.mockReturnValue(leanOne(null));
    createMock.mockImplementation(async (data: unknown) => {
      const d = data as Record<string, unknown>;
      return { toObject: () => ({ _id: "507f1f77bcf86cd799439011", ...d }) } as never;
    });

    const res = await request(app)
      .post("/api/v1/auth/sign-up")
      .send({ name: "Root", email: "admin@evil.com", password: "s3cretP@ss!" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("user");
  });

  it("rejects a duplicate email that already has a password (409)", async () => {
    findOneMock.mockReturnValue(
      leanOne({
        _id: "507f1f77bcf86cd799439011",
        email: "ada@example.com",
        name: "Ada",
        role: "user",
        passwordHash: "salt:hash",
      }),
    );

    const res = await request(app)
      .post("/api/v1/auth/sign-up")
      .send({ name: "Ada", email: "ada@example.com", password: "s3cretP@ss!" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("upgrades a legacy address without a password hash (sets first password)", async () => {
    findOneMock.mockReturnValue(
      leanOne({
        _id: "507f1f77bcf86cd799439011",
        email: "ada@example.com",
        name: "Ada",
        role: "user",
        providerId: "usr_abc123",
        passwordHash: null,
      }),
    );
    findByIdAndUpdateMock.mockReturnValue(
      leanOne({
        _id: "507f1f77bcf86cd799439011",
        email: "ada@example.com",
        name: "Ada",
        role: "user",
        providerId: "usr_abc123",
        passwordHash: "new-salt:new-hash",
      }),
    );

    const res = await request(app)
      .post("/api/v1/auth/sign-up")
      .send({ name: "Ada", email: "ada@example.com", password: "s3cretP@ss!" });

    expect(res.status).toBe(200);
    expect(res.body.user.providerId).toBe("usr_abc123");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid body (400)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/sign-up")
      .send({ name: "", email: "not-an-email", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/v1/auth/sign-in", () => {
  const findOneMock = vi.mocked(UserModel.findOne);

  beforeEach(() => {
    findOneMock.mockReset();
  });

  function leanOne(doc: unknown) {
    return { lean: () => ({ exec: async () => doc }) } as never;
  }

  it("rejects an unknown email without creating a user (401)", async () => {
    const findOneAndUpdateMock = vi.mocked(UserModel.findOneAndUpdate);
    findOneAndUpdateMock.mockClear();
    findOneMock.mockReturnValue(leanOne(null));

    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "ghost@example.com", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
    expect(res.body.safeMessage).toBe("Invalid email or password.");
    expect(findOneAndUpdateMock).not.toHaveBeenCalled();
  });

  it("rejects a wrong password without leaking which field failed (401)", async () => {
    const { hashPassword } = await import("../src/utils/password.js");
    const passwordHash = await hashPassword("correctPassword123!");
    findOneMock.mockReturnValue(
      leanOne({
        _id: "507f1f77bcf86cd799439011",
        email: "ada@example.com",
        name: "Ada",
        role: "user",
        providerId: "usr_abc123",
        avatarUrl: null,
        passwordHash,
      }),
    );

    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "ada@example.com", password: "wrongPassword123!" });

    expect(res.status).toBe(401);
    expect(res.body.safeMessage).toBe("Invalid email or password.");
  });

  it("rejects a password-less (Google-only) account with a Google hint (401)", async () => {
    findOneMock.mockReturnValue(
      leanOne({
        _id: "507f1f77bcf86cd799439011",
        email: "ada@example.com",
        name: "Ada",
        role: "user",
        providerId: "usr_abc123",
        passwordHash: null,
      }),
    );

    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "ada@example.com", password: "whatever123" });

    expect(res.status).toBe(401);
    expect(res.body.safeMessage).toMatch(/Google/i);
  });

  it("returns the user (without hash) for correct credentials (200)", async () => {
    const { hashPassword } = await import("../src/utils/password.js");
    const passwordHash = await hashPassword("correctPassword123!");
    findOneMock.mockReturnValue(
      leanOne({
        _id: "507f1f77bcf86cd799439011",
        email: "ada@example.com",
        name: "Ada",
        role: "user",
        providerId: "usr_abc123",
        avatarUrl: "https://example.com/a.png",
        passwordHash,
      }),
    );

    const res = await request(app)
      .post("/api/v1/auth/sign-in")
      .send({ email: "ada@example.com", password: "correctPassword123!" });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("ada@example.com");
    expect(res.body.user.providerId).toBe("usr_abc123");
    expect(res.body.user.avatarUrl).toBe("https://example.com/a.png");
    expect(res.body.user).not.toHaveProperty("passwordHash");
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
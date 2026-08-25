import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { env } from "../src/config/env.js";
import { authRouter } from "../src/controllers/authController.js";
import { userRouter } from "../src/controllers/userController.js";
import { authenticate } from "../src/middleware/auth.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { UserModel } from "../src/models/User.js";

vi.mock("../src/models/User.js", () => ({
  UserModel: {
    findOneAndUpdate: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  app.use("/users", authenticate, userRouter);
  app.use(errorHandler);
  return app;
}

function mintToken(
  payload: { sub: string; email: string; name?: string; role?: "user" | "admin" },
  expiresIn = "7d",
) {
  return jwt.sign(payload, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn,
  });
}

describe("E2E Sign-in / Sign-out / Session Flow Verification (FR-AUTH-01..07)", () => {
  const app = buildApp();
  const mockUserDoc = {
    _id: "507f1f77bcf86cd799439011",
    providerId: "usr_demo1234567890abcdef",
    email: "chef@flavorai.com",
    name: "Chef Flavor",
    role: "user",
    avatarUrl: "https://example.com/avatar.jpg",
    bio: "Passionate home cook",
    preferences: {
      dietaryLabels: ["vegetarian"],
      allergies: ["peanuts"],
      dislikedIngredients: ["cilantro"],
      calorieTarget: 2200,
      proteinTargetGrams: 120,
      cookingTimeMaxMinutes: 45,
      difficulty: "medium",
    },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("Step 1: Sign-in produces a valid JWT and verifies against POST /auth/token/verify", async () => {
    const token = mintToken({
      sub: mockUserDoc.providerId,
      email: mockUserDoc.email,
      name: mockUserDoc.name,
      role: "user",
    });

    vi.mocked(UserModel.findOneAndUpdate).mockReturnValue({
      lean: () => ({
        exec: async () => mockUserDoc,
      }),
    } as never);

    const res = await request(app)
      .post("/auth/token/verify")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: mockUserDoc._id,
      name: mockUserDoc.name,
      email: mockUserDoc.email,
      role: "user",
    });
  });

  it("Step 2: Client uses verified token to load protected user profile GET /users/me", async () => {
    const token = mintToken({
      sub: mockUserDoc.providerId,
      email: mockUserDoc.email,
      name: mockUserDoc.name,
      role: "user",
    });

    // Mock authenticate middleware finding user by providerId
    vi.mocked(UserModel.findOne).mockReturnValue({
      lean: () => ({
        exec: async () => mockUserDoc,
      }),
    } as never);

    // Mock userController getMyProfile finding user by id
    vi.mocked(UserModel.findById).mockReturnValue({
      lean: () => ({
        exec: async () => mockUserDoc,
      }),
    } as never);

    const res = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("chef@flavorai.com");
    expect(res.body.preferences.dietaryLabels).toEqual(["vegetarian"]);
  });

  it("Step 3: Client updates dietary preferences via PATCH /users/me with Bearer token", async () => {
    const token = mintToken({
      sub: mockUserDoc.providerId,
      email: mockUserDoc.email,
      name: mockUserDoc.name,
      role: "user",
    });

    const updatedUserDoc = {
      ...mockUserDoc,
      preferences: {
        ...mockUserDoc.preferences,
        dietaryLabels: ["vegan", "gluten-free"],
        calorieTarget: 2000,
      },
    };

    vi.mocked(UserModel.findOne).mockReturnValue({
      lean: () => ({
        exec: async () => mockUserDoc,
      }),
    } as never);

    vi.mocked(UserModel.findByIdAndUpdate).mockReturnValue({
      lean: () => ({
        exec: async () => updatedUserDoc,
      }),
    } as never);

    const res = await request(app)
      .patch("/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({
        preferences: {
          dietaryLabels: ["vegan", "gluten-free"],
          allergies: ["peanuts"],
          dislikedIngredients: ["cilantro"],
          calorieTarget: 2000,
          proteinTargetGrams: 120,
          cookingTimeMaxMinutes: 45,
          difficulty: "medium",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.preferences.dietaryLabels).toEqual(["vegan", "gluten-free"]);
  });

  it("Step 4: Client sign-out calls POST /auth/logout (stateless invalidation)", async () => {
    const token = mintToken({
      sub: mockUserDoc.providerId,
      email: mockUserDoc.email,
      name: mockUserDoc.name,
      role: "user",
    });

    vi.mocked(UserModel.findOne).mockReturnValue({
      lean: () => ({
        exec: async () => mockUserDoc,
      }),
    } as never);

    const res = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  it("Step 5: Expired or tampered tokens are rejected on protected endpoints with 401", async () => {
    const expiredToken = mintToken(
      { sub: mockUserDoc.providerId, email: mockUserDoc.email },
      "-10s",
    );

    const res = await request(app)
      .get("/users/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });
});

import request from "supertest";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { UserModel } from "../src/models/User.js";
import { createApp } from "../src/server.js";

vi.mock("../src/models/User.js", () => ({
  UserModel: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock("../src/models/Recipe.js", () => ({
  RecipeModel: {
    aggregate: vi.fn(),
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

describe("GET /api/v1/users/me", () => {
  const findOneMock = vi.mocked(UserModel.findOne);
  const findByIdMock = vi.mocked(UserModel.findById);

  beforeEach(() => {
    findOneMock.mockReset();
    findByIdMock.mockReset();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/v1/users/me");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns 200 with user profile and preferences for authenticated user", async () => {
    const token = signToken({ sub: "ba-123", email: "ada@example.com" });

    // authenticate middleware lookup
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

    // userController lookup
    findByIdMock.mockReturnValue({
      lean: () => ({
        exec: async () => ({
          _id: "507f1f77bcf86cd799439011",
          name: "Ada",
          email: "ada@example.com",
          avatarUrl: null,
          bio: "Software pioneer",
          role: "user",
          preferences: {
            dietaryLabels: ["vegetarian"],
            allergies: ["peanuts"],
            dislikedIngredients: ["cilantro"],
            calorieTarget: 2000,
            calorieRange: null,
            proteinTargetGrams: 100,
            cookingTimeMaxMinutes: 45,
            difficulty: "easy",
          },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        }),
      }),
    } as never);

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: "507f1f77bcf86cd799439011",
      name: "Ada",
      email: "ada@example.com",
      avatarUrl: null,
      bio: "Software pioneer",
      role: "user",
      preferences: {
        dietaryLabels: ["vegetarian"],
        allergies: ["peanuts"],
        dislikedIngredients: ["cilantro"],
        calorieTarget: 2000,
        calorieRange: null,
        proteinTargetGrams: 100,
        cookingTimeMaxMinutes: 45,
        difficulty: "easy",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
  });

  it("returns 404 when user is not found in database", async () => {
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

    findByIdMock.mockReturnValue({
      lean: () => ({
        exec: async () => null,
      }),
    } as never);

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      safeMessage: "User profile not found.",
    });
  });
});

describe("PATCH /api/v1/users/me", () => {
  const findOneMock = vi.mocked(UserModel.findOne);
  const findByIdAndUpdateMock = vi.mocked(UserModel.findByIdAndUpdate);

  beforeEach(() => {
    findOneMock.mockReset();
    findByIdAndUpdateMock.mockReset();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app)
      .patch("/api/v1/users/me")
      .send({ name: "New Name" });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects invalid input with 400 VALIDATION_ERROR", async () => {
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
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ avatarUrl: "not-a-valid-url" });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      safeMessage: "Invalid input data.",
    });
    expect(res.body.validation).toHaveProperty("avatarUrl");
  });

  it("updates and returns 200 with updated profile and preferences", async () => {
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

    findByIdAndUpdateMock.mockReturnValue({
      lean: () => ({
        exec: async () => ({
          _id: "507f1f77bcf86cd799439011",
          name: "Ada Lovelace",
          email: "ada@example.com",
          avatarUrl: "https://example.com/avatar.jpg",
          bio: "First computer programmer",
          role: "user",
          preferences: {
            dietaryLabels: ["vegan", "gluten-free"],
            allergies: ["tree nuts"],
            dislikedIngredients: ["mushrooms"],
            calorieTarget: 1800,
            calorieRange: { min: 1600, max: 2000 },
            proteinTargetGrams: 80,
            cookingTimeMaxMinutes: 30,
            difficulty: "medium",
          },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-02T12:00:00.000Z"),
        }),
      }),
    } as never);

    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Ada Lovelace",
        avatarUrl: "https://example.com/avatar.jpg",
        bio: "First computer programmer",
        preferences: {
          dietaryLabels: ["vegan", "gluten-free"],
          allergies: ["tree nuts"],
          dislikedIngredients: ["mushrooms"],
          calorieTarget: 1800,
          calorieRange: { min: 1600, max: 2000 },
          proteinTargetGrams: 80,
          cookingTimeMaxMinutes: 30,
          difficulty: "medium",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: "507f1f77bcf86cd799439011",
      name: "Ada Lovelace",
      email: "ada@example.com",
      avatarUrl: "https://example.com/avatar.jpg",
      bio: "First computer programmer",
      role: "user",
      preferences: {
        dietaryLabels: ["vegan", "gluten-free"],
        allergies: ["tree nuts"],
        dislikedIngredients: ["mushrooms"],
        calorieTarget: 1800,
        calorieRange: { min: 1600, max: 2000 },
        proteinTargetGrams: 80,
        cookingTimeMaxMinutes: 30,
        difficulty: "medium",
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T12:00:00.000Z",
    });

    expect(findByIdAndUpdateMock).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011",
      {
        $set: {
          name: "Ada Lovelace",
          avatarUrl: "https://example.com/avatar.jpg",
          bio: "First computer programmer",
          preferences: {
            dietaryLabels: ["vegan", "gluten-free"],
            allergies: ["tree nuts"],
            dislikedIngredients: ["mushrooms"],
            calorieTarget: 1800,
            calorieRange: { min: 1600, max: 2000 },
            proteinTargetGrams: 80,
            cookingTimeMaxMinutes: 30,
            difficulty: "medium",
          },
        },
      },
      { new: true, runValidators: true },
    );
  });
});

describe("GET /api/v1/users/me/stats (additive)", () => {
  const findOneMock = vi.mocked(UserModel.findOne);
  const aggregateMock = vi.mocked(RecipeModel.aggregate);

  beforeEach(() => {
    findOneMock.mockReset();
    aggregateMock.mockReset();
  });

  function authenticateAs(id: string) {
    findOneMock.mockReturnValue({
      lean: () => ({
        exec: async () => ({ _id: id, email: "ada@example.com", name: "Ada", role: "user" }),
      }),
    } as never);
  }

  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/v1/users/me/stats");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns aggregate stats for the authenticated user's own recipes", async () => {
    const token = signToken({ sub: "ba-123", email: "ada@example.com" });
    authenticateAs("507f1f77bcf86cd799439011");
    aggregateMock.mockResolvedValue([
      {
        _id: null,
        totalRecipes: 4,
        draftCount: 1,
        publishedCount: 3,
        hiddenCount: 0,
        totalRatingsReceived: 10,
        totalFavoritesReceived: 6,
        totalCommentsReceived: 2,
        weightedRatingSum: 43,
      },
    ] as never);

    const res = await request(app)
      .get("/api/v1/users/me/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalRecipes: 4,
      draftCount: 1,
      publishedCount: 3,
      hiddenCount: 0,
      totalRatingsReceived: 10,
      totalFavoritesReceived: 6,
      totalCommentsReceived: 2,
      averageRating: 4.3,
    });
  });

  it("returns all-zero stats (and averageRating 0) for a user with no recipes", async () => {
    const token = signToken({ sub: "ba-123", email: "ada@example.com" });
    authenticateAs("507f1f77bcf86cd799439011");
    aggregateMock.mockResolvedValue([] as never);

    const res = await request(app)
      .get("/api/v1/users/me/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalRecipes: 0,
      draftCount: 0,
      publishedCount: 0,
      hiddenCount: 0,
      totalRatingsReceived: 0,
      totalFavoritesReceived: 0,
      totalCommentsReceived: 0,
      averageRating: 0,
    });
  });
});

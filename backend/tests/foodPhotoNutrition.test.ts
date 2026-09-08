import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { UserModel } from "../src/models/User.js";
import { createApp } from "../src/server.js";
import * as aiService from "../src/services/aiService.js";
import {
  DetectedFoodItem,
  FoodPhotoAnalysisInput,
  FoodPhotoAnalysisResult,
  NutritionRange,
} from "../src/types/index.js";

const app = createApp();
let mongo: MongoMemoryServer;

function signToken(
  providerId: string,
  role: "user" | "admin" = "user",
  expiresIn: string = "15m",
): string {
  return jwt.sign({ sub: providerId, role }, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn,
  });
}

const mockAnalysisResult: FoodPhotoAnalysisResult = {
  dishName: "Grilled Salmon with Asparagus and Quinoa",
  summary:
    "A well-balanced plate featuring a grilled salmon fillet served with tender asparagus spears and fluffy quinoa.",
  detectedFoods: [
    {
      name: "Grilled Atlantic Salmon",
      portion: "150g fillet",
      confidence: "high",
      calories: 280,
      proteinGrams: 34,
      carbsGrams: 0,
      fatGrams: 15,
      fiberGrams: 0,
    },
    {
      name: "Cooked Quinoa",
      portion: "1/2 cup (90g)",
      confidence: "high",
      calories: 110,
      proteinGrams: 4,
      carbsGrams: 20,
      fatGrams: 2,
      fiberGrams: 3,
    },
    {
      name: "Steamed Asparagus",
      portion: "6 spears (90g)",
      confidence: "medium",
      calories: 20,
      proteinGrams: 2,
      carbsGrams: 4,
      fatGrams: 0,
      fiberGrams: 2,
    },
  ],
  totalNutrition: {
    calories: { min: 370, max: 450, estimate: 410 },
    proteinGrams: { min: 36, max: 44, estimate: 40 },
    carbsGrams: { min: 20, max: 28, estimate: 24 },
    fatGrams: { min: 14, max: 20, estimate: 17 },
    fiberGrams: { min: 4, max: 7, estimate: 5 },
  },
  macroDistribution: {
    proteinPercentage: 39,
    carbsPercentage: 23,
    fatPercentage: 38,
  },
  dietaryTags: ["high-protein", "gluten-free", "dairy-free"],
  allergenWarnings: ["Fish (Salmon)"],
  healthInsights: [
    "High in heart-healthy Omega-3 fatty acids and complete bioavailable protein.",
    "Provides complex carbohydrates with good dietary fiber content.",
  ],
  suggestedIngredientsForRecipe: [
    "salmon fillet",
    "quinoa",
    "asparagus",
    "olive oil",
    "lemon",
    "black pepper",
  ],
  disclaimer:
    "Nutritional values are approximate AI estimations based on visual appearance and should not be used as clinical or medical advice.",
};

describe("Food Photo Nutrition Analysis (FR-PHOTO-01..04)", () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Schema Validation (Zod Contracts)", () => {
    it("validates a compliant FoodPhotoAnalysisResult object", () => {
      const parsed = FoodPhotoAnalysisResult.safeParse(mockAnalysisResult);
      expect(parsed.success).toBe(true);
    });

    it("validates DetectedFoodItem and NutritionRange schemas", () => {
      const item = {
        name: "Avocado Toast",
        portion: "1 slice (120g)",
        confidence: "high",
        calories: 240,
        proteinGrams: 6,
        carbsGrams: 22,
        fatGrams: 15,
        fiberGrams: 7,
      };
      expect(DetectedFoodItem.safeParse(item).success).toBe(true);

      const range = { min: 200, max: 300, estimate: 250 };
      expect(NutritionRange.safeParse(range).success).toBe(true);

      // Negative values rejected
      expect(NutritionRange.safeParse({ min: -10, max: 300, estimate: 250 }).success).toBe(false);
    });

    it("rejects FoodPhotoAnalysisResult with missing detected foods or invalid ranges", () => {
      const invalid = {
        ...mockAnalysisResult,
        detectedFoods: [], // At least one required
      };
      expect(FoodPhotoAnalysisResult.safeParse(invalid).success).toBe(false);
    });

    it("validates FoodPhotoAnalysisInput schema constraints", () => {
      expect(
        FoodPhotoAnalysisInput.safeParse({
          image: "https://example.com/food.jpg",
          mealContext: "Lunch bowl",
        }).success,
      ).toBe(true);

      expect(FoodPhotoAnalysisInput.safeParse({ image: "" }).success).toBe(false);
    });
  });

  describe("Prompt Builder", () => {
    it("builds visual analysis prompt with context and notes", () => {
      const { systemPrompt, userPrompt } = aiService.buildFoodPhotoAnalysisPrompt(
        "Keto post-workout lunch",
        "Extra olive oil added on top",
      );

      expect(systemPrompt).toContain("FlavorAI Food Vision & Nutrition Analyst");
      expect(systemPrompt).toContain('"dishName"');
      expect(systemPrompt).toContain('"macroDistribution"');
      expect(userPrompt).toContain("Keto post-workout lunch");
      expect(userPrompt).toContain("Extra olive oil added on top");
    });
  });

  describe("aiService.analyzeFoodPhoto unit tests", () => {
    it("validates image size and rejects payloads larger than 5MB", async () => {
      const hugeBase64 = Buffer.alloc(6 * 1024 * 1024).toString("base64");
      await expect(
        aiService.analyzeFoodPhoto({
          image: hugeBase64,
          mimeType: "image/jpeg",
        }),
      ).rejects.toThrow(/exceeds maximum allowed size of 5 MB/i);
    });

    it("rejects unsupported MIME types", async () => {
      const smallBase64 = Buffer.from("fake-image").toString("base64");
      await expect(
        aiService.analyzeFoodPhoto({
          image: smallBase64,
          mimeType: "application/pdf",
        }),
      ).rejects.toThrow(/Invalid image type/i);
    });

    it("successfully analyzes food photo with mock fetch", async () => {
      const smallBase64 = Buffer.from("fake-png-data").toString("base64");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockAnalysisResult),
              },
            },
          ],
        }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      const result = await aiService.analyzeFoodPhoto({
        image: `data:image/png;base64,${smallBase64}`,
        mealContext: "Healthy lunch",
      });

      expect(result.dishName).toBe("Grilled Salmon with Asparagus and Quinoa");
      expect(result.detectedFoods).toHaveLength(3);
      expect(result.totalNutrition.calories.estimate).toBe(410);
      expect(result.macroDistribution.proteinPercentage).toBe(39);
    });

    it("handles AI provider error safely", async () => {
      const smallBase64 = Buffer.from("fake-png-data").toString("base64");

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal server error at provider",
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      await expect(
        aiService.analyzeFoodPhoto({
          image: `data:image/png;base64,${smallBase64}`,
        }),
      ).rejects.toThrow(/Food photo nutrition analysis service unavailable/i);
    });
  });

  describe("POST /api/v1/ai/nutrition/analyze-photo endpoint", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const res = await request(app)
        .post("/api/v1/ai/nutrition/analyze-photo")
        .send({ image: "https://example.com/salmon.jpg" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });

    it("rejects invalid request body with 400", async () => {
      const providerId = `auth0|${new mongoose.Types.ObjectId().toString()}`;
      await UserModel.create({
        name: "Test Chef",
        email: "chef_photo@flavorai.demo",
        providerId,
      });
      const token = signToken(providerId);

      const res = await request(app)
        .post("/api/v1/ai/nutrition/analyze-photo")
        .set("Authorization", `Bearer ${token}`)
        .send({ image: "" }); // Empty image

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 200 and structured nutrition analysis for valid authenticated request", async () => {
      const providerId = `auth0|${new mongoose.Types.ObjectId().toString()}`;
      await UserModel.create({
        name: "Test Chef 2",
        email: "chef_photo2@flavorai.demo",
        providerId,
      });
      const token = signToken(providerId);

      vi.spyOn(aiService, "analyzeFoodPhoto").mockResolvedValue(mockAnalysisResult);

      const res = await request(app)
        .post("/api/v1/ai/nutrition/analyze-photo")
        .set("Authorization", `Bearer ${token}`)
        .send({
          image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
          mealContext: "Power salad bowl",
        });

      expect(res.status).toBe(200);
      expect(res.body.dishName).toBe("Grilled Salmon with Asparagus and Quinoa");
      expect(res.body.detectedFoods).toHaveLength(3);
      expect(res.body.macroDistribution.proteinPercentage).toBe(39);
      expect(res.body.disclaimer).toBeDefined();
      expect(res.body.suggestedIngredientsForRecipe).toContain("salmon fillet");
    });
  });
});

import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { env } from "../src/config/env.js";
import { UserModel } from "../src/models/User.js";
import { createApp } from "../src/server.js";
import * as aiService from "../src/services/aiService.js";
import * as imageService from "../src/services/imageService.js";

vi.mock("../src/models/User.js", () => ({
  UserModel: {
    findOne: vi.fn().mockReturnValue({
      lean: () => ({
        exec: async () => ({
          _id: "507f1f77bcf86cd799439011",
          email: "chef@example.com",
          name: "Chef",
          role: "user",
        }),
      }),
    }),
  },
}));

const app = createApp();

function signToken(userId: string = "507f1f77bcf86cd799439011", role: "user" | "admin" = "user"): string {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: "15m",
  });
}

describe("AI Controller & Upload Routes Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(UserModel.findOne).mockReturnValue({
      lean: () => ({
        exec: async () => ({
          _id: "507f1f77bcf86cd799439011",
          email: "chef@example.com",
          name: "Chef",
          role: "user",
        }),
      }),
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/v1/ai/recipes/generate", () => {
    it("rejects unauthorized requests without a Bearer token (401)", async () => {
      const res = await request(app)
        .post("/api/v1/ai/recipes/generate")
        .send({ ingredients: ["chicken"] });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });

    it("rejects invalid request body with 400 VALIDATION_ERROR", async () => {
      const token = signToken();
      const res = await request(app)
        .post("/api/v1/ai/recipes/generate")
        .set("Authorization", `Bearer ${token}`)
        .send({ ingredients: [] }); // empty array fails min(1)

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("calls aiService.generateAIRecipe and returns 200 on success", async () => {
      const token = signToken();
      const mockResult = {
        recipe: {
          title: "Mock Chicken Recipe",
          summary: "Mock summary",
          ingredients: [{ name: "chicken", pantryMatch: "used" as const }],
          steps: [{ stepNumber: 1, instruction: "Cook chicken." }],
          prepTimeMinutes: 10,
          cookTimeMinutes: 15,
          servings: 2,
          difficulty: "easy" as const,
          tags: [],
          dietaryLabels: [],
          allergenWarnings: [],
        },
        pantryMatch: {
          usedIngredients: ["chicken"],
          missingIngredients: [],
          usageCount: 1,
          missingCount: 0,
        },
      };

      vi.spyOn(aiService, "generateAIRecipe").mockResolvedValue(mockResult as any);

      const res = await request(app)
        .post("/api/v1/ai/recipes/generate")
        .set("Authorization", `Bearer ${token}`)
        .send({
          ingredients: ["chicken"],
          servings: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.recipe.title).toBe("Mock Chicken Recipe");
      expect(res.body.pantryMatch.usedIngredients).toContain("chicken");
    });
  });

  describe("POST /api/v1/ai/flavor-pairings", () => {
    it("rejects unauthorized requests without a Bearer token (401)", async () => {
      const res = await request(app)
        .post("/api/v1/ai/flavor-pairings")
        .send({ ingredient: "salmon" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });

    it("rejects invalid request body (missing ingredient) with 400 VALIDATION_ERROR", async () => {
      const token = signToken();
      const res = await request(app)
        .post("/api/v1/ai/flavor-pairings")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("calls aiService.generateFlavorPairings and returns 200 on success", async () => {
      const token = signToken();
      const mockSuggestions = {
        suggestions: [
          { ingredient: "lemon", reason: "Adds brightness", type: "addition" as const },
        ],
      };

      vi.spyOn(aiService, "generateFlavorPairings").mockResolvedValue(mockSuggestions);

      const res = await request(app)
        .post("/api/v1/ai/flavor-pairings")
        .set("Authorization", `Bearer ${token}`)
        .send({ ingredient: "salmon" });

      expect(res.status).toBe(200);
      expect(res.body.suggestions).toHaveLength(1);
      expect(res.body.suggestions[0].ingredient).toBe("lemon");
    });
  });

  describe("POST /api/v1/ai/recipes/taste-match", () => {
    it("rejects unauthorized requests without a Bearer token (401)", async () => {
      const res = await request(app)
        .post("/api/v1/ai/recipes/taste-match")
        .send({ tastes: ["spicy"] });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });

    it("rejects invalid request body (empty tastes array) with 400 VALIDATION_ERROR", async () => {
      const token = signToken();
      const res = await request(app)
        .post("/api/v1/ai/recipes/taste-match")
        .set("Authorization", `Bearer ${token}`)
        .send({ tastes: [] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects an unknown taste value with 400 VALIDATION_ERROR", async () => {
      const token = signToken();
      const res = await request(app)
        .post("/api/v1/ai/recipes/taste-match")
        .set("Authorization", `Bearer ${token}`)
        .send({ tastes: ["chocolatey"] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("calls aiService.matchRecipesToTaste and returns 200 on success", async () => {
      const token = signToken();
      const mockResult = {
        matches: [
          {
            recipe: { id: "507f1f77bcf86cd799439012", title: "Spicy Miso Ramen" },
            score: 92,
            matchedTastes: ["spicy", "umami"],
            reason: "Chili oil and miso broth deliver a strong spicy-umami combination.",
          },
        ],
      };

      vi.spyOn(aiService, "matchRecipesToTaste").mockResolvedValue(mockResult as any);

      const res = await request(app)
        .post("/api/v1/ai/recipes/taste-match")
        .set("Authorization", `Bearer ${token}`)
        .send({ tastes: ["spicy", "umami"] });

      expect(res.status).toBe(200);
      expect(res.body.matches).toHaveLength(1);
      expect(res.body.matches[0].score).toBe(92);
    });
  });

  describe("POST /api/v1/upload/image", () => {
    it("rejects unauthorized requests without a Bearer token (401)", async () => {
      const res = await request(app)
        .post("/api/v1/upload/image")
        .send({ image: "base64data" });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });

    it("rejects missing image data with 400 VALIDATION_ERROR", async () => {
      const token = signToken();
      const res = await request(app)
        .post("/api/v1/upload/image")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("calls imageService.uploadImageToImgBB and returns 200 on success", async () => {
      const token = signToken();
      vi.spyOn(imageService, "uploadImageToImgBB").mockResolvedValue({
        imageUrl: "https://i.ibb.co/test/image.jpg",
      });

      const res = await request(app)
        .post("/api/v1/upload/image")
        .set("Authorization", `Bearer ${token}`)
        .send({
          image: "dGVzdA==",
          mimeType: "image/jpeg",
          filename: "test.jpg",
        });

      expect(res.status).toBe(200);
      expect(res.body.imageUrl).toBe("https://i.ibb.co/test/image.jpg");
    });
  });
});

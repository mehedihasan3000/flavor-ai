import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { CommentModel } from "../src/models/Comment.js";
import { FavoriteModel } from "../src/models/Favorite.js";
import { RatingModel } from "../src/models/Rating.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { UserModel } from "../src/models/User.js";
import { createApp } from "../src/server.js";
import * as aiService from "../src/services/aiService.js";

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

async function createUser(
  name: string,
  email: string,
  role: "user" | "admin" = "user",
): Promise<{ id: string; providerId: string; token: string }> {
  const providerId = `auth0|${new mongoose.Types.ObjectId().toString()}`;
  const user = await UserModel.create({
    name,
    email,
    role,
    providerId,
    preferences: {
      dietaryLabels: [],
      allergies: [],
      dislikedIngredients: [],
      calorieTarget: 2000,
      calorieRange: null,
      proteinTargetGrams: null,
      cookingTimeMaxMinutes: null,
      difficulty: null,
    },
  });
  return {
    id: user._id.toString(),
    providerId,
    token: signToken(providerId, role),
  };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await RecipeModel.syncIndexes();
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
  }
});

beforeEach(async () => {
  await Promise.all([
    UserModel.deleteMany({}),
    RecipeModel.deleteMany({}),
    RatingModel.deleteMany({}),
    CommentModel.deleteMany({}),
    FavoriteModel.deleteMany({}),
  ]);
  vi.restoreAllMocks();
});

describe("Section 6.2 — End-to-End User Journey (E2E Flow)", () => {
  it("executes complete lifecycle: Sign-in → Generate AI Recipe → Save/Publish → Search → Rate → Comment → Favorite", async () => {
    // -------------------------------------------------------------------------
    // Step 1: User 1 (Chef Anna) signs in and verifies token
    // -------------------------------------------------------------------------
    const chefAnna = await createUser("Chef Anna", "anna@example.com");

    const authVerifyRes = await request(app)
      .post("/api/v1/auth/token/verify")
      .set("Authorization", `Bearer ${chefAnna.token}`);
    expect(authVerifyRes.status).toBe(200);
    expect(authVerifyRes.body.user.email).toBe("anna@example.com");

    // -------------------------------------------------------------------------
    // Step 2: Chef Anna generates an AI recipe with pantry ingredients
    // -------------------------------------------------------------------------
    const mockAiRecipe = {
      title: "Garlic Butter Shrimp Pasta",
      summary: "Succulent shrimp tossed in fragrant garlic butter linguine",
      ingredients: [
        { name: "shrimp", quantity: 300, unit: "grams", pantryMatch: "used" as const },
        { name: "garlic", quantity: 4, unit: "cloves", pantryMatch: "used" as const },
        { name: "butter", quantity: 2, unit: "tbsp", pantryMatch: "used" as const },
        { name: "linguine pasta", quantity: 200, unit: "grams", pantryMatch: "used" as const },
        { name: "fresh parsley", quantity: 2, unit: "tbsp", pantryMatch: "missing" as const },
      ],
      steps: [
        { stepNumber: 1, instruction: "Boil linguine pasta in salted water until al dente." },
        { stepNumber: 2, instruction: "Sauté garlic in butter, add shrimp and cook for 3 minutes." },
        { stepNumber: 3, instruction: "Toss pasta with shrimp butter sauce and fresh parsley." },
      ],
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      servings: 2,
      difficulty: "easy" as const,
      cuisine: "Italian",
      category: "main-course" as const,
      tags: ["pasta", "seafood", "quick"],
      dietaryLabels: ["high-protein" as const],
      allergenWarnings: ["shellfish", "dairy", "gluten"],
      nutrition: {
        caloriesPerServing: 520,
        proteinGramsPerServing: 34,
        carbsGramsPerServing: 58,
        fatGramsPerServing: 16,
      },
    };

    vi.spyOn(aiService, "generateAIRecipe").mockResolvedValue({
      recipe: mockAiRecipe,
      pantryMatch: {
        usedIngredients: ["shrimp", "garlic", "butter", "linguine pasta"],
        missingIngredients: ["fresh parsley"],
        usageCount: 4,
        missingCount: 1,
      },
    });

    const aiGenRes = await request(app)
      .post("/api/v1/ai/recipes/generate")
      .set("Authorization", `Bearer ${chefAnna.token}`)
      .send({
        ingredients: ["shrimp", "garlic", "butter", "linguine pasta"],
        servings: 2,
        cuisine: "Italian",
      });

    expect(aiGenRes.status).toBe(200);
    expect(aiGenRes.body.recipe.title).toBe("Garlic Butter Shrimp Pasta");
    expect(aiGenRes.body.pantryMatch.usageCount).toBe(4);

    // -------------------------------------------------------------------------
    // Step 3: Save generated recipe as a draft
    // -------------------------------------------------------------------------
    const saveDraftRes = await request(app)
      .post("/api/v1/recipes")
      .set("Authorization", `Bearer ${chefAnna.token}`)
      .send({
        title: aiGenRes.body.recipe.title,
        slug: "garlic-butter-shrimp-pasta",
        summary: aiGenRes.body.recipe.summary,
        ingredients: aiGenRes.body.recipe.ingredients,
        steps: aiGenRes.body.recipe.steps,
        prepTimeMinutes: aiGenRes.body.recipe.prepTimeMinutes,
        cookTimeMinutes: aiGenRes.body.recipe.cookTimeMinutes,
        servings: aiGenRes.body.recipe.servings,
        difficulty: aiGenRes.body.recipe.difficulty,
        cuisine: aiGenRes.body.recipe.cuisine,
        category: aiGenRes.body.recipe.category,
        tags: aiGenRes.body.recipe.tags,
        dietaryLabels: aiGenRes.body.recipe.dietaryLabels,
        allergenWarnings: aiGenRes.body.recipe.allergenWarnings,
        nutrition: aiGenRes.body.recipe.nutrition,
      });

    expect(saveDraftRes.status).toBe(201);
    expect(saveDraftRes.body.recipe.status).toBe("draft");
    expect(saveDraftRes.body.recipe.totalTimeMinutes).toBe(25);
    const recipeId = saveDraftRes.body.recipe.id;

    // Verify draft is NOT visible in public search
    const draftSearch = await request(app).get("/api/v1/recipes?q=shrimp");
    expect(draftSearch.status).toBe(200);
    expect(draftSearch.body.items).toHaveLength(0);

    // -------------------------------------------------------------------------
    // Step 4: Publish recipe
    // -------------------------------------------------------------------------
    const publishRes = await request(app)
      .post(`/api/v1/recipes/${recipeId}/publish`)
      .set("Authorization", `Bearer ${chefAnna.token}`);
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.recipe.status).toBe("published");

    // Verify recipe is now in public discovery
    const publicSearch = await request(app).get("/api/v1/recipes?q=shrimp");
    expect(publicSearch.status).toBe(200);
    expect(publicSearch.body.items).toHaveLength(1);
    expect(publicSearch.body.items[0].id).toBe(recipeId);

    // -------------------------------------------------------------------------
    // Step 5: User 2 (Foodie Ben) searches, rates, comments, and favorites
    // -------------------------------------------------------------------------
    const foodieBen = await createUser("Foodie Ben", "ben@example.com");

    // Search by category
    const catSearch = await request(app).get("/api/v1/recipes?category=main-course");
    expect(catSearch.status).toBe(200);
    expect(catSearch.body.items.some((r: any) => r.id === recipeId)).toBe(true);

    // Ben rates 5 stars
    const rateRes = await request(app)
      .put(`/api/v1/recipes/${recipeId}/ratings`)
      .set("Authorization", `Bearer ${foodieBen.token}`)
      .send({ value: 5 });
    expect(rateRes.status).toBe(200);
    expect(rateRes.body.summary.averageRating).toBe(5);
    expect(rateRes.body.summary.ratingCount).toBe(1);

    // Ben leaves a comment
    const commentRes = await request(app)
      .post(`/api/v1/recipes/${recipeId}/comments`)
      .set("Authorization", `Bearer ${foodieBen.token}`)
      .send({ body: "Made this for dinner tonight, absolutely incredible flavor!" });
    expect(commentRes.status).toBe(201);
    expect(commentRes.body.comment.authorName).toBe("Foodie Ben");

    // Ben favorites the recipe
    const favRes = await request(app)
      .put(`/api/v1/favorites/${recipeId}`)
      .set("Authorization", `Bearer ${foodieBen.token}`);
    expect(favRes.status).toBe(200);

    // Ben checks his favorites feed
    const benFavorites = await request(app)
      .get("/api/v1/favorites")
      .set("Authorization", `Bearer ${foodieBen.token}`);
    expect(benFavorites.status).toBe(200);
    expect(benFavorites.body.items).toHaveLength(1);
    expect(benFavorites.body.items[0].recipe.id).toBe(recipeId);

    // -------------------------------------------------------------------------
    // Step 6: Verify Author's (Chef Anna's) updated dashboard statistics
    // -------------------------------------------------------------------------
    const annaStats = await request(app)
      .get("/api/v1/users/me/stats")
      .set("Authorization", `Bearer ${chefAnna.token}`);
    expect(annaStats.status).toBe(200);
    expect(annaStats.body.totalRecipes).toBe(1);
    expect(annaStats.body.publishedCount).toBe(1);
    expect(annaStats.body.totalRatingsReceived).toBe(1);
    expect(annaStats.body.averageRating).toBe(5);
    expect(annaStats.body.totalCommentsReceived).toBe(1);
    expect(annaStats.body.totalFavoritesReceived).toBe(1);
  });
});

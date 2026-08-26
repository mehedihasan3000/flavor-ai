import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { CommentModel } from "../src/models/Comment.js";
import { FavoriteModel } from "../src/models/Favorite.js";
import { RatingModel } from "../src/models/Rating.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { UserModel } from "../src/models/User.js";
import { createApp } from "../src/server.js";

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
});

describe("Section 6.1 — Integration Gates Test Suite", () => {
  describe("Gate 1: M2 Auth & JWT Bridge Verification", () => {
    it("verifies Bearer JWT signature, issuer, audience, and rejects invalid/expired tokens", async () => {
      const user = await createUser("Alice", "alice@example.com");

      // 1. Valid token succeeds
      const resValid = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${user.token}`);
      expect(resValid.status).toBe(200);
      expect(resValid.body.id).toBe(user.id);
      expect(resValid.body.email).toBe("alice@example.com");

      // 2. Missing token -> 401
      const resMissing = await request(app).get("/api/v1/users/me");
      expect(resMissing.status).toBe(401);
      expect(resMissing.body.code).toBe("UNAUTHORIZED");

      // 3. Expired token -> 401
      const expiredToken = signToken(user.providerId, "user", "-1s");
      const resExpired = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${expiredToken}`);
      expect(resExpired.status).toBe(401);
      expect(resExpired.body.code).toBe("UNAUTHORIZED");

      // 4. Bad secret -> 401
      const badSecretToken = jwt.sign(
        { sub: user.providerId, role: "user" },
        "wrong-secret-key-12345678901234567890",
        {
          issuer: env.JWT_ISSUER,
          audience: env.JWT_AUDIENCE,
        },
      );
      const resBadSecret = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${badSecretToken}`);
      expect(resBadSecret.status).toBe(401);
      expect(resBadSecret.body.code).toBe("UNAUTHORIZED");
    });

    it("updates user profile & full dietary preferences successfully via PATCH /users/me", async () => {
      const user = await createUser("Bob", "bob@example.com");

      const updatePayload = {
        name: "Bob Chef",
        bio: "Passionate home cook",
        preferences: {
          dietaryLabels: ["gluten-free", "high-protein"],
          allergies: ["peanuts"],
          dislikedIngredients: ["mushrooms"],
          calorieTarget: 2200,
          calorieRange: { min: 2000, max: 2400 },
          proteinTargetGrams: 140,
          cookingTimeMaxMinutes: 30,
          difficulty: "medium",
        },
      };

      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${user.token}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Bob Chef");
      expect(res.body.preferences.dietaryLabels).toEqual(["gluten-free", "high-protein"]);
      expect(res.body.preferences.allergies).toEqual(["peanuts"]);
      expect(res.body.preferences.proteinTargetGrams).toBe(140);
    });
  });

  describe("Gate 2: M3 Recipe Lifecycle (Draft → Edit → Publish → Unpublish)", () => {
    it("creates draft, auto-computes totalTime, enforces draft privacy, publishes, and unpublishes", async () => {
      const user = await createUser("Chef Charlie", "charlie@example.com");

      // 1. Create draft recipe
      const createRes = await request(app)
        .post("/api/v1/recipes")
        .set("Authorization", `Bearer ${user.token}`)
        .send({
          title: "Lemon Herb Salmon",
          slug: "lemon-herb-salmon",
          summary: "Zesty fresh salmon fillet with herbs",
          prepTimeMinutes: 15,
          cookTimeMinutes: 25,
          servings: 4,
          difficulty: "medium",
          cuisine: "Mediterranean",
          category: "main-course",
          dietaryLabels: ["gluten-free", "high-protein"],
          ingredients: [
            { name: "salmon fillet", quantity: 4, unit: "pieces", pantryMatch: "used" },
            { name: "lemon", quantity: 1, unit: "whole", pantryMatch: "used" },
            { name: "fresh dill", quantity: 2, unit: "tbsp", pantryMatch: "missing" },
          ],
          steps: [
            { stepNumber: 1, instruction: "Preheat oven to 400F." },
            { stepNumber: 2, instruction: "Season salmon and bake for 25 minutes." },
          ],
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.recipe.status).toBe("draft");
      expect(createRes.body.recipe.totalTimeMinutes).toBe(40); // 15 + 25
      const recipeId = createRes.body.recipe.id;

      // 2. Draft is NOT visible in public search
      const publicSearch1 = await request(app).get("/api/v1/recipes?q=salmon");
      expect(publicSearch1.status).toBe(200);
      expect(publicSearch1.body.items).toHaveLength(0);

      // 3. Edit recipe and recompute total time
      const editRes = await request(app)
        .patch(`/api/v1/recipes/${recipeId}`)
        .set("Authorization", `Bearer ${user.token}`)
        .send({
          prepTimeMinutes: 10,
          cookTimeMinutes: 20,
          summary: "Quick weeknight zesty salmon",
        });
      expect(editRes.status).toBe(200);
      expect(editRes.body.recipe.totalTimeMinutes).toBe(30); // 10 + 20
      expect(editRes.body.recipe.summary).toBe("Quick weeknight zesty salmon");

      // 4. Publish recipe
      const publishRes = await request(app)
        .post(`/api/v1/recipes/${recipeId}/publish`)
        .set("Authorization", `Bearer ${user.token}`);
      expect(publishRes.status).toBe(200);
      expect(publishRes.body.recipe.status).toBe("published");
      expect(publishRes.body.recipe.publishedAt).toBeDefined();

      // 5. Recipe is now visible in public search
      const publicSearch2 = await request(app).get("/api/v1/recipes?q=salmon");
      expect(publicSearch2.status).toBe(200);
      expect(publicSearch2.body.items).toHaveLength(1);
      expect(publicSearch2.body.items[0].id).toBe(recipeId);

      // 6. Unpublish recipe
      const unpublishRes = await request(app)
        .post(`/api/v1/recipes/${recipeId}/unpublish`)
        .set("Authorization", `Bearer ${user.token}`);
      expect(unpublishRes.status).toBe(200);
      expect(unpublishRes.body.recipe.status).toBe("draft");

      // 7. Recipe vanishes from public search
      const publicSearch3 = await request(app).get("/api/v1/recipes?q=salmon");
      expect(publicSearch3.status).toBe(200);
      expect(publicSearch3.body.items).toHaveLength(0);
    });
  });

  describe("Gate 3: M4 Community Flow (Search → Rate → Comment → Favorite)", () => {
    it("allows a community member to discover, rate, comment, and favorite a published recipe", async () => {
      const author = await createUser("Author Ann", "ann@example.com");
      const fan = await createUser("Fan Frank", "frank@example.com");

      // Author publishes a recipe
      const createRes = await request(app)
        .post("/api/v1/recipes")
        .set("Authorization", `Bearer ${author.token}`)
        .send({
          title: "Avocado Toast Deluxe",
          slug: "avocado-toast-deluxe",
          summary: "Toasted sourdough with creamy mashed avocado and chili flakes",
          prepTimeMinutes: 5,
          cookTimeMinutes: 5,
          servings: 2,
          difficulty: "easy",
          cuisine: "American",
          category: "appetizer",
          dietaryLabels: ["vegetarian", "dairy-free"],
          ingredients: [
            { name: "sourdough bread", quantity: 2, unit: "slices" },
            { name: "ripe avocado", quantity: 1, unit: "whole" },
          ],
          steps: [{ stepNumber: 1, instruction: "Toast bread and spread seasoned avocado." }],
        });
      expect(createRes.status).toBe(201);
      const recipeId = createRes.body.recipe.id;

      await request(app)
        .post(`/api/v1/recipes/${recipeId}/publish`)
        .set("Authorization", `Bearer ${author.token}`);

      // 1. Search recipe
      const searchRes = await request(app).get("/api/v1/recipes?category=appetizer");
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.items).toHaveLength(1);

      // 2. Author cannot rate own recipe (FR-RATE-04)
      const authorRate = await request(app)
        .put(`/api/v1/recipes/${recipeId}/ratings`)
        .set("Authorization", `Bearer ${author.token}`)
        .send({ value: 5 });
      expect(authorRate.status).toBe(403);
      expect(authorRate.body.code).toBe("FORBIDDEN");

      // 3. Fan rates recipe with 5 stars
      const fanRate = await request(app)
        .put(`/api/v1/recipes/${recipeId}/ratings`)
        .set("Authorization", `Bearer ${fan.token}`)
        .send({ value: 5 });
      expect(fanRate.status).toBe(200);
      expect(fanRate.body.summary.averageRating).toBe(5);
      expect(fanRate.body.summary.ratingCount).toBe(1);

      // 4. Fan posts a comment (verifying HTML sanitization)
      const commentRes = await request(app)
        .post(`/api/v1/recipes/${recipeId}/comments`)
        .set("Authorization", `Bearer ${fan.token}`)
        .send({ body: "Delicious breakfast! <script>alert('xss')</script> Super quick." });
      expect(commentRes.status).toBe(201);
      expect(commentRes.body.comment.body).not.toContain("<script>");
      expect(commentRes.body.comment.body).toContain("Delicious breakfast!");
      expect(commentRes.body.comment.authorName).toBe("Fan Frank");

      // Recipe comment count incremented
      const recipeDetail = await request(app).get(`/api/v1/recipes/${recipeId}`);
      expect(recipeDetail.body.recipe.commentCount).toBe(1);
      expect(recipeDetail.body.recipe.averageRating).toBe(5);

      // 5. Fan favorites the recipe
      const favRes = await request(app)
        .put(`/api/v1/favorites/${recipeId}`)
        .set("Authorization", `Bearer ${fan.token}`);
      expect(favRes.status).toBe(200);

      // Check favorite status
      const favStatus = await request(app)
        .get(`/api/v1/favorites/${recipeId}`)
        .set("Authorization", `Bearer ${fan.token}`);
      expect(favStatus.status).toBe(200);
      expect(favStatus.body.favorited).toBe(true);

      // Fetch favorites list
      const favList = await request(app)
        .get("/api/v1/favorites")
        .set("Authorization", `Bearer ${fan.token}`);
      expect(favList.status).toBe(200);
      expect(favList.body.items).toHaveLength(1);
      expect(favList.body.items[0].recipe.id).toBe(recipeId);
    });
  });

  describe("Gate 4: Cross-User Authorization (403 on Unauthorized Mutations)", () => {
    it("strictly forbids modifying or deleting other users' recipes and comments", async () => {
      const userA = await createUser("User Alpha", "alpha@example.com");
      const userB = await createUser("User Beta", "beta@example.com");
      const admin = await createUser("Admin User", "admin@example.com", "admin");

      // User A creates and publishes recipe
      const createRecipeRes = await request(app)
        .post("/api/v1/recipes")
        .set("Authorization", `Bearer ${userA.token}`)
        .send({
          title: "Secret Family Pasta",
          slug: "secret-family-pasta",
          summary: "Heritage recipe",
          prepTimeMinutes: 10,
          cookTimeMinutes: 15,
          servings: 2,
          difficulty: "easy",
          ingredients: [{ name: "pasta", quantity: 200, unit: "grams" }],
          steps: [{ stepNumber: 1, instruction: "Boil and serve." }],
        });
      const recipeId = createRecipeRes.body.recipe.id;

      await request(app)
        .post(`/api/v1/recipes/${recipeId}/publish`)
        .set("Authorization", `Bearer ${userA.token}`);

      // User A creates a comment
      const createCommentRes = await request(app)
        .post(`/api/v1/recipes/${recipeId}/comments`)
        .set("Authorization", `Bearer ${userA.token}`)
        .send({ body: "Author original note." });
      const commentId = createCommentRes.body.comment.id;

      // 1. User B tries to PATCH User A's recipe -> 403
      const patchRecipeRes = await request(app)
        .patch(`/api/v1/recipes/${recipeId}`)
        .set("Authorization", `Bearer ${userB.token}`)
        .send({ title: "Hacked Recipe" });
      expect(patchRecipeRes.status).toBe(403);
      expect(patchRecipeRes.body.code).toBe("FORBIDDEN");

      // 2. User B tries to unpublish User A's recipe -> 403
      const unpublishRecipeRes = await request(app)
        .post(`/api/v1/recipes/${recipeId}/unpublish`)
        .set("Authorization", `Bearer ${userB.token}`);
      expect(unpublishRecipeRes.status).toBe(403);

      // 3. User B tries to DELETE User A's recipe -> 403
      const deleteRecipeRes = await request(app)
        .delete(`/api/v1/recipes/${recipeId}`)
        .set("Authorization", `Bearer ${userB.token}`);
      expect(deleteRecipeRes.status).toBe(403);

      // 4. User B tries to PATCH User A's comment -> 403
      const patchCommentRes = await request(app)
        .patch(`/api/v1/comments/${commentId}`)
        .set("Authorization", `Bearer ${userB.token}`)
        .send({ body: "Hacked comment." });
      expect(patchCommentRes.status).toBe(403);

      // 5. User B tries to DELETE User A's comment -> 403
      const deleteCommentRes = await request(app)
        .delete(`/api/v1/comments/${commentId}`)
        .set("Authorization", `Bearer ${userB.token}`);
      expect(deleteCommentRes.status).toBe(403);

      // 6. Admin CAN delete User A's comment -> 200
      const adminDeleteComment = await request(app)
        .delete(`/api/v1/comments/${commentId}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(adminDeleteComment.status).toBe(200);

      // 7. Admin CAN delete User A's recipe -> 204
      const adminDeleteRecipe = await request(app)
        .delete(`/api/v1/recipes/${recipeId}`)
        .set("Authorization", `Bearer ${admin.token}`);
      expect(adminDeleteRecipe.status).toBe(204);
    });
  });

  describe("Gate 5: Re-rate & Favorites Deduplication / Idempotency", () => {
    it("updates existing rating without duplicates and handles duplicate favorite additions idempotently", async () => {
      const author = await createUser("Chef Dante", "dante@example.com");
      const user = await createUser("Reviewer Rita", "rita@example.com");

      const createRes = await request(app)
        .post("/api/v1/recipes")
        .set("Authorization", `Bearer ${author.token}`)
        .send({
          title: "Classic Margherita Pizza",
          slug: "classic-margherita-pizza",
          summary: "Crispy crust with tomato sauce and fresh basil",
          prepTimeMinutes: 20,
          cookTimeMinutes: 10,
          servings: 3,
          difficulty: "medium",
          ingredients: [{ name: "dough", quantity: 1, unit: "ball" }],
          steps: [{ stepNumber: 1, instruction: "Bake at 500F." }],
        });
      const recipeId = createRes.body.recipe.id;

      await request(app)
        .post(`/api/v1/recipes/${recipeId}/publish`)
        .set("Authorization", `Bearer ${author.token}`);

      // 1. First rating: 3 stars
      const rate1 = await request(app)
        .put(`/api/v1/recipes/${recipeId}/ratings`)
        .set("Authorization", `Bearer ${user.token}`)
        .send({ value: 3 });
      expect(rate1.status).toBe(200);
      expect(rate1.body.summary.averageRating).toBe(3);
      expect(rate1.body.summary.ratingCount).toBe(1);

      // 2. Re-rate as same user: 5 stars -> updates in-place, count remains 1
      const rate2 = await request(app)
        .put(`/api/v1/recipes/${recipeId}/ratings`)
        .set("Authorization", `Bearer ${user.token}`)
        .send({ value: 5 });
      expect(rate2.status).toBe(200);
      expect(rate2.body.summary.averageRating).toBe(5);
      expect(rate2.body.summary.ratingCount).toBe(1);

      // Verify DB has only 1 rating document
      const ratingDocs = await RatingModel.find({ recipe: recipeId, user: user.id });
      expect(ratingDocs).toHaveLength(1);
      expect(ratingDocs[0].value).toBe(5);

      // 3. Favorite recipe once
      const fav1 = await request(app)
        .put(`/api/v1/favorites/${recipeId}`)
        .set("Authorization", `Bearer ${user.token}`);
      expect(fav1.status).toBe(200);

      // 4. Favorite recipe second time -> idempotent 200, favoriteCount is 1
      const fav2 = await request(app)
        .put(`/api/v1/favorites/${recipeId}`)
        .set("Authorization", `Bearer ${user.token}`);
      expect(fav2.status).toBe(200);

      // Verify DB has only 1 favorite document
      const favDocs = await FavoriteModel.find({ recipe: recipeId, user: user.id });
      expect(favDocs).toHaveLength(1);

      const recipeDoc = await RecipeModel.findById(recipeId);
      expect(recipeDoc?.favoriteCount).toBe(1);

      // 5. Remove favorite
      const removeFav = await request(app)
        .delete(`/api/v1/favorites/${recipeId}`)
        .set("Authorization", `Bearer ${user.token}`);
      expect(removeFav.status).toBe(200);

      const favDocsAfter = await FavoriteModel.find({ recipe: recipeId, user: user.id });
      expect(favDocsAfter).toHaveLength(0);

      const recipeDocAfter = await RecipeModel.findById(recipeId);
      expect(recipeDocAfter?.favoriteCount).toBe(0);
    });
  });
});

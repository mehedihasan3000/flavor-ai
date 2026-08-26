import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { UserModel } from "../src/models/User.js";
import { createApp } from "../src/server.js";

const app = createApp();
let mongo: MongoMemoryServer;

function signToken(userId: string, role: "user" | "admin" = "user"): string {
  return jwt.sign({ sub: userId, role }, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: "15m",
  });
}

async function createUser(name: string, email: string): Promise<{ id: string; token: string }> {
  // authenticate() looks users up by providerId (the external auth subject),
  // not Mongo _id — must be set for a real request to pass requireAuth.
  const providerId = new mongoose.Types.ObjectId().toString();
  const user = await UserModel.create({ name, email, providerId });
  return { id: user._id.toString(), token: signToken(providerId) };
}

const validRecipeBody = {
  title: "Garlic Spinach Chicken",
  slug: "garlic-spinach-chicken",
  summary: "Quick weeknight dinner",
  ingredients: [{ name: "chicken breast", quantity: 2, unit: "pieces" }],
  steps: [{ stepNumber: 1, instruction: "Season and pan-sear the chicken." }],
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  servings: 2,
  difficulty: "easy",
};

async function seedRecipe(
  token: string,
  overrides: Partial<typeof validRecipeBody> & { slug: string; title: string },
) {
  const res = await request(app)
    .post("/api/v1/recipes")
    .set("Authorization", `Bearer ${token}`)
    .send({ ...validRecipeBody, ...overrides });
  expect(res.status).toBe(201);
  const id = res.body.recipe.id as string;
  const pub = await request(app)
    .post(`/api/v1/recipes/${id}/publish`)
    .set("Authorization", `Bearer ${token}`);
  expect(pub.status).toBe(200);
  return { id, recipe: res.body.recipe };
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
  await Promise.all([RecipeModel.deleteMany({}), UserModel.deleteMany({})]);
});

describe("GET /recipes — public search (FR-SEARCH-01..05)", () => {
  it("returns only published recipes", async () => {
    const { token } = await createUser("Ada", "ada@example.com");
    await seedRecipe(token, { slug: "published-soup", title: "Published Soup" });
    await request(app)
      .post("/api/v1/recipes")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validRecipeBody, slug: "unpublished-soup", title: "Unpublished Soup" });

    const res = await request(app).get("/api/v1/recipes");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].title).toBe("Published Soup");
  });

  it("returns the pagination envelope", async () => {
    const { token } = await createUser("Ada", "ada@example.com");
    await seedRecipe(token, { slug: "recipe-a", title: "Dish A" });
    await seedRecipe(token, { slug: "recipe-b", title: "Dish B" });
    await seedRecipe(token, { slug: "recipe-c", title: "Dish C" });

    const res = await request(app).get("/api/v1/recipes?page=1&limit=10");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 10, total: 3, totalPages: 1 });
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items[0]).toHaveProperty("id");
    expect(res.body.items[0]).toHaveProperty("averageRating");
  });

  it("searches keywords across title, summary, and ingredients (FR-SEARCH-02)", async () => {
    const { token } = await createUser("Ada", "ada@example.com");
    await seedRecipe(token, {
      slug: "spinach-chicken",
      title: "Garlic Spinach Chicken",
      ingredients: [{ name: "chicken breast", quantity: 2, unit: "pieces" }],
    });
    await seedRecipe(token, {
      slug: "lentil-soup",
      title: "Vegan Lentil Soup",
      ingredients: [{ name: "lentils", quantity: 200, unit: "g" }],
    });

    const byTitle = await request(app).get("/api/v1/recipes?q=chicken");
    expect(byTitle.body.total).toBe(1);
    expect(byTitle.body.items[0].title).toBe("Garlic Spinach Chicken");

    const byIngredient = await request(app).get("/api/v1/recipes?q=lentils");
    expect(byIngredient.body.total).toBe(1);
    expect(byIngredient.body.items[0].title).toBe("Vegan Lentil Soup");
  });

  it("filters by category, cuisine, diet, and difficulty (FR-SEARCH-03)", async () => {
    const { token } = await createUser("Ada", "ada@example.com");
    await seedRecipe(token, {
      slug: "med-chicken",
      title: "Mediterranean Chicken",
      cuisine: "mediterranean",
      category: "main-course",
      dietaryLabels: ["gluten-free"],
      difficulty: "easy",
    });
    await seedRecipe(token, {
      slug: "italian-soup",
      title: "Italian Soup",
      cuisine: "italian",
      category: "soup",
      dietaryLabels: ["vegan"],
      difficulty: "medium",
    });

    const category = await request(app).get("/api/v1/recipes?category=soup");
    expect(category.body.total).toBe(1);
    expect(category.body.items[0].title).toBe("Italian Soup");

    const cuisine = await request(app).get("/api/v1/recipes?cuisine=mediterranean");
    expect(cuisine.body.total).toBe(1);

    const diet = await request(app).get("/api/v1/recipes?diet=vegan");
    expect(diet.body.total).toBe(1);
    expect(diet.body.items[0].title).toBe("Italian Soup");

    const difficulty = await request(app).get("/api/v1/recipes?difficulty=medium");
    expect(difficulty.body.total).toBe(1);
  });

  it("filters by max cooking time (totalTimeMinutes)", async () => {
    const { token } = await createUser("Ada", "ada@example.com");
    await seedRecipe(token, {
      slug: "quick",
      title: "Quick Dish",
      prepTimeMinutes: 10,
      cookTimeMinutes: 20,
    });
    await seedRecipe(token, {
      slug: "slow",
      title: "Slow Dish",
      prepTimeMinutes: 15,
      cookTimeMinutes: 60,
    });

    const res = await request(app).get("/api/v1/recipes?maxCookingTimeMinutes=45");
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].title).toBe("Quick Dish");
  });

  it("sorts by newest, highest-rated, and most-popular (FR-SEARCH-04)", async () => {
    const { token } = await createUser("Ada", "ada@example.com");
    const a = await seedRecipe(token, { slug: "recipe-a", title: "Dish A" });
    const b = await seedRecipe(token, { slug: "recipe-b", title: "Dish B" });
    const c = await seedRecipe(token, { slug: "recipe-c", title: "Dish C" });

    await RecipeModel.findByIdAndUpdate(a.id, { averageRating: 4.5, ratingCount: 10 });
    await RecipeModel.findByIdAndUpdate(b.id, { averageRating: 3, ratingCount: 5 });
    await RecipeModel.findByIdAndUpdate(c.id, {
      averageRating: 5,
      ratingCount: 1,
      favoriteCount: 50,
    });

    const newest = await request(app).get("/api/v1/recipes?sort=newest");
    expect(newest.body.items[0].title).toBe("Dish C");

    const rated = await request(app).get("/api/v1/recipes?sort=highest-rated");
    expect(rated.body.items[0].title).toBe("Dish C");

    const popular = await request(app).get("/api/v1/recipes?sort=most-popular");
    expect(popular.body.items[0].title).toBe("Dish C");

    const combined = await request(app).get("/api/v1/recipes?q=title&sort=newest");
    expect(combined.status).toBe(200);
  });

  it("paginates results (FR-SEARCH-05)", async () => {
    const { token } = await createUser("Ada", "ada@example.com");
    for (let i = 0; i < 5; i += 1) {
      await seedRecipe(token, { slug: `recipe-${i}`, title: `Recipe ${i}` });
    }

    const page1 = await request(app).get("/api/v1/recipes?page=1&limit=2");
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.total).toBe(5);
    expect(page1.body.totalPages).toBe(3);

    const page3 = await request(app).get("/api/v1/recipes?page=3&limit=2");
    expect(page3.body.items).toHaveLength(1);
  });

  it("rejects invalid query params (400)", async () => {
    const res = await request(app).get("/api/v1/recipes?limit=500");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /recipes?mine=true — own recipes across all statuses (additive)", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/v1/recipes?mine=true");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("returns only the caller's own recipes, including drafts", async () => {
    const ada = await createUser("Ada", "ada@example.com");
    const zed = await createUser("Zed", "zed@example.com");

    await seedRecipe(ada.token, { slug: "ada-published", title: "Ada Published" });
    await request(app)
      .post("/api/v1/recipes")
      .set("Authorization", `Bearer ${ada.token}`)
      .send({ ...validRecipeBody, slug: "ada-draft", title: "Ada Draft" });
    await seedRecipe(zed.token, { slug: "zed-published", title: "Zed Published" });

    const res = await request(app)
      .get("/api/v1/recipes?mine=true")
      .set("Authorization", `Bearer ${ada.token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const titles = res.body.items.map((item: { title: string }) => item.title).sort();
    expect(titles).toEqual(["Ada Draft", "Ada Published"]);
  });

  it("honors status only alongside mine=true", async () => {
    const ada = await createUser("Ada", "ada@example.com");
    await seedRecipe(ada.token, { slug: "ada-published-2", title: "Ada Published 2" });
    await request(app)
      .post("/api/v1/recipes")
      .set("Authorization", `Bearer ${ada.token}`)
      .send({ ...validRecipeBody, slug: "ada-draft-2", title: "Ada Draft 2" });

    const drafts = await request(app)
      .get("/api/v1/recipes?mine=true&status=draft")
      .set("Authorization", `Bearer ${ada.token}`);
    expect(drafts.body.total).toBe(1);
    expect(drafts.body.items[0].title).toBe("Ada Draft 2");

    // Without mine=true, status is ignored and public search stays published-only.
    const publicWithStatus = await request(app).get("/api/v1/recipes?status=draft");
    expect(publicWithStatus.status).toBe(200);
    expect(
      (publicWithStatus.body.items as { status: string }[]).every((r) => r.status === "published"),
    ).toBe(true);
  });
});

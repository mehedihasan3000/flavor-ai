import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { sanitizeMongoOperators } from "../src/middleware/sanitizeInput.js";
import { MealPlanModel } from "../src/models/MealPlan.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { UserModel } from "../src/models/User.js";
import { mealPlansRouter } from "../src/routes/mealPlans.js";

/**
 * Meal-plan manual CRUD tests (FEATURES_TASKS.md §B5, Dev B).
 * DB-backed via mongodb-memory-server; auth via real `requireAuth`
 * (users matched by `providerId`, token `sub` = providerId).
 * The router is mounted here exactly as the Lead will mount it in `v1.ts`
 * (`/api/v1/meal-plans`); `v1.ts` itself is Lead-owned and untouched.
 */

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(sanitizeMongoOperators);
  app.use("/api/v1/meal-plans", mealPlansRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();
let mongo: MongoMemoryServer;

function signToken(providerId: string, role: "user" | "admin" = "user"): string {
  return jwt.sign({ sub: providerId, role }, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: "15m",
  });
}

async function createUser(
  name: string,
  email: string,
  role: "user" | "admin" = "user",
): Promise<{ token: string; userId: string }> {
  const providerId = `test|${new mongoose.Types.ObjectId().toString()}`;
  const user = await UserModel.create({ name, email, role, providerId });
  return { token: signToken(providerId, role), userId: String(user._id) };
}

let recipeCounter = 0;
async function seedRecipe(
  ownerId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string }> {
  recipeCounter += 1;
  const recipe = await RecipeModel.create({
    owner: ownerId,
    source: "manual",
    title: `Plan Recipe ${recipeCounter}`,
    slug: `plan-recipe-${recipeCounter}-${Date.now()}`,
    ingredients: [{ name: "Chicken", quantity: 500, unit: "g" }],
    steps: [{ stepNumber: 1, instruction: "Cook it." }],
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 2,
    difficulty: "easy",
    status: "published",
    publishedAt: new Date(),
    ...overrides,
  });
  return { id: String(recipe._id) };
}

const BASE = "/api/v1/meal-plans";
const WEEK_START = "2026-09-21";
const WEEK_END = "2026-09-27";

function planBody(recipeId: string, extraMeals: Array<Record<string, unknown>> = []) {
  return {
    name: "My Week",
    weekStartDate: WEEK_START,
    weekEndDate: WEEK_END,
    meals: [
      {
        date: "2026-09-23",
        mealType: "dinner",
        recipeId,
        servings: 2,
      },
      ...extraMeals,
    ],
  };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await MealPlanModel.syncIndexes();
  await RecipeModel.syncIndexes();
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    UserModel.deleteMany({}),
    RecipeModel.deleteMany({}),
    MealPlanModel.deleteMany({}),
  ]);
});

describe("meal plans manual CRUD (FEATURES_TASKS.md §B5)", () => {
  describe("POST /meal-plans (create)", () => {
    it("creates a plan with populated recipe cards", async () => {
      const { token, userId } = await createUser("Dev B", "devb@example.com");
      const recipe = await seedRecipe(userId);

      const res = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(planBody(recipe.id));

      expect(res.status).toBe(201);
      expect(res.body.plan.name).toBe("My Week");
      expect(res.body.plan.weekStartDate).toBe(WEEK_START);
      expect(res.body.plan.meals).toHaveLength(1);
      expect(res.body.plan.meals[0].mealId).toMatch(/^[0-9a-fA-F]{24}$/);
      expect(res.body.plan.meals[0].missing).toBe(false);
      expect(res.body.plan.meals[0].recipe.title).toBe("Plan Recipe 1");
    });

    it("creates an empty-meals shell for the AI flow", async () => {
      const { token } = await createUser("Dev B", "devb@example.com");

      const res = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send({ weekStartDate: WEEK_START, weekEndDate: WEEK_END });

      expect(res.status).toBe(201);
      expect(res.body.plan.meals).toEqual([]);
      expect(res.body.plan.name).toBe("My Week");
    });

    it("rejects an unpublished (draft) recipeId with 404", async () => {
      const { token, userId } = await createUser("Dev B", "devb@example.com");
      const draft = await seedRecipe(userId, { status: "draft" });

      const res = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(planBody(draft.id));

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });

    it("rejects an out-of-range meal date with 400", async () => {
      const { token, userId } = await createUser("Dev B", "devb@example.com");
      const recipe = await seedRecipe(userId);

      const ok = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(planBody(recipe.id));

      expect(ok.status).toBe(201);

      const bad = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send({
          weekStartDate: WEEK_START,
          weekEndDate: WEEK_END,
          meals: [{ date: "2026-10-05", mealType: "dinner", recipeId: recipe.id, servings: 2 }],
        });

      expect(bad.status).toBe(400);
      expect(bad.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a duplicate (date, mealType) slot with 400", async () => {
      const { token, userId } = await createUser("Dev B", "devb@example.com");
      const recipe = await seedRecipe(userId);

      const res = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(
          planBody(recipe.id, [
            { date: "2026-09-23", mealType: "dinner", recipeId: recipe.id, servings: 2 },
          ]),
        );

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects weekEndDate on/before weekStartDate with 400", async () => {
      const { token } = await createUser("Dev B", "devb@example.com");

      const res = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send({ weekStartDate: WEEK_END, weekEndDate: WEEK_START });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("requires authentication", async () => {
      const res = await request(app)
        .post(BASE)
        .send({ weekStartDate: WEEK_START, weekEndDate: WEEK_END });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /meal-plans (list)", () => {
    it("lists only the caller's plans and filters favorites", async () => {
      const alice = await createUser("Alice", "alice@example.com");
      const bob = await createUser("Bob", "bob@example.com");
      const recipe = await seedRecipe(alice.userId);

      await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${alice.token}`)
        .send({ name: "Fav Week", weekStartDate: WEEK_START, weekEndDate: WEEK_END });
      const plans = await MealPlanModel.find({}).lean().exec();
      await MealPlanModel.updateOne(
        { _id: plans[0]._id },
        { $set: { isFavorite: true } },
      ).exec();

      const all = await request(app).get(BASE).set("Authorization", `Bearer ${alice.token}`);
      expect(all.status).toBe(200);
      expect(all.body.total).toBe(1);

      const fav = await request(app)
        .get(`${BASE}?isFavorite=true`)
        .set("Authorization", `Bearer ${alice.token}`);
      expect(fav.status).toBe(200);
      expect(fav.body.total).toBe(1);

      // `isFavorite=false` means "don't filter" (unchecked checkbox), not "non-favorites".
      const notFav = await request(app)
        .get(`${BASE}?isFavorite=false`)
        .set("Authorization", `Bearer ${alice.token}`);
      expect(notFav.body.total).toBe(1);

      const other = await request(app).get(BASE).set("Authorization", `Bearer ${bob.token}`);
      expect(other.body.total).toBe(0);
      expect(recipe.id).toMatch(/^[0-9a-fA-F]{24}$/);
    });
  });

  describe("GET /meal-plans/:id (detail)", () => {
    it("tolerates a deleted recipe (recipe null + missing true, never 500)", async () => {
      const { token, userId } = await createUser("Dev B", "devb@example.com");
      const recipe = await seedRecipe(userId);

      const created = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(planBody(recipe.id));
      await RecipeModel.deleteOne({ _id: recipe.id }).exec();

      const res = await request(app)
        .get(`${BASE}/${created.body.plan.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.plan.meals[0].recipe).toBeNull();
      expect(res.body.plan.meals[0].missing).toBe(true);
    });

    it("returns 404 for another user's plan, including admins", async () => {
      const alice = await createUser("Alice", "alice@example.com");
      const bob = await createUser("Bob", "bob@example.com");
      const admin = await createUser("Admin", "admin@example.com", "admin");
      const recipe = await seedRecipe(alice.userId);

      const created = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${alice.token}`)
        .send(planBody(recipe.id));

      for (const other of [bob, admin]) {
        const res = await request(app)
          .get(`${BASE}/${created.body.plan.id}`)
          .set("Authorization", `Bearer ${other.token}`);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("NOT_FOUND");
      }
    });

    it("returns 400 for a malformed :id", async () => {
      const { token } = await createUser("Dev B", "devb@example.com");

      const res = await request(app)
        .get(`${BASE}/not-an-id`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("PATCH /meal-plans/:id (update)", () => {
    it("moves a meal, changes servings, and toggles favorite without touching status", async () => {
      const { token, userId } = await createUser("Dev B", "devb@example.com");
      const recipe = await seedRecipe(userId);

      const created = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(planBody(recipe.id));
      const planId = created.body.plan.id as string;
      const mealId = created.body.plan.meals[0].mealId as string;

      const moved = await request(app)
        .patch(`${BASE}/${planId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          meals: [
            {
              date: "2026-09-24",
              mealType: "lunch",
              recipeId: recipe.id,
              servings: 4,
              source: "manual",
            },
          ],
        });

      expect(moved.status).toBe(200);
      expect(moved.body.plan.meals[0].date).toBe("2026-09-24");
      expect(moved.body.plan.meals[0].mealType).toBe("lunch");
      expect(moved.body.plan.meals[0].servings).toBe(4);
      expect(moved.body.plan.meals[0].missing).toBe(false);
      expect(mealId).toMatch(/^[0-9a-fA-F]{24}$/);

      const fav = await request(app)
        .patch(`${BASE}/${planId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ isFavorite: true });

      expect(fav.status).toBe(200);
      expect(fav.body.plan.isFavorite).toBe(true);
      expect(fav.body.plan.status).toBe("active");
    });

    it("rejects moving a meal outside the week with 400", async () => {
      const { token, userId } = await createUser("Dev B", "devb@example.com");
      const recipe = await seedRecipe(userId);

      const created = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(planBody(recipe.id));

      const res = await request(app)
        .patch(`${BASE}/${created.body.plan.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          meals: [
            { date: "2026-12-25", mealType: "dinner", recipeId: recipe.id, servings: 2 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects swapping in an unpublished recipe with 404", async () => {
      const { token, userId } = await createUser("Dev B", "devb@example.com");
      const recipe = await seedRecipe(userId);
      const hidden = await seedRecipe(userId, { status: "hidden" });

      const created = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${token}`)
        .send(planBody(recipe.id));

      const res = await request(app)
        .patch(`${BASE}/${created.body.plan.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          meals: [
            { date: "2026-09-23", mealType: "dinner", recipeId: hidden.id, servings: 2 },
          ],
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });
  });

  describe("DELETE /meal-plans/:id", () => {
    it("deletes the plan and 404s afterwards; cross-user delete 404s", async () => {
      const alice = await createUser("Alice", "alice@example.com");
      const bob = await createUser("Bob", "bob@example.com");
      const recipe = await seedRecipe(alice.userId);

      const created = await request(app)
        .post(BASE)
        .set("Authorization", `Bearer ${alice.token}`)
        .send(planBody(recipe.id));
      const planId = created.body.plan.id as string;

      const cross = await request(app)
        .delete(`${BASE}/${planId}`)
        .set("Authorization", `Bearer ${bob.token}`);
      expect(cross.status).toBe(404);

      const deleted = await request(app)
        .delete(`${BASE}/${planId}`)
        .set("Authorization", `Bearer ${alice.token}`);
      expect(deleted.status).toBe(200);
      expect(deleted.body.success).toBe(true);

      const gone = await request(app)
        .get(`${BASE}/${planId}`)
        .set("Authorization", `Bearer ${alice.token}`);
      expect(gone.status).toBe(404);
    });
  });
});

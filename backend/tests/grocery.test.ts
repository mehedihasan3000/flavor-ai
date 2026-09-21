import express from "express";
import jwt from "jsonwebtoken";
import mongoose, { Schema, Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { sanitizeMongoOperators } from "../src/middleware/sanitizeInput.js";
import { GroceryListModel } from "../src/models/GroceryList.js";
import { PantryItemModel } from "../src/models/PantryItem.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { UserModel } from "../src/models/User.js";
import { groceryListsRouter } from "../src/routes/groceryLists.js";

/**
 * MealPlan model fallback for test suite fixtures.
 */
const MealPlanModel =
  mongoose.models.MealPlan ||
  mongoose.model(
    "MealPlan",
    new Schema(
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String },
        meals: [
          {
            recipeId: { type: Schema.Types.ObjectId, ref: "Recipe" },
            servings: { type: Number },
            mealType: { type: String },
            date: { type: String },
          },
        ],
      },
      { timestamps: true },
    ),
  );

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(sanitizeMongoOperators);
  app.use("/api/v1/grocery-lists", groceryListsRouter);
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
): Promise<{ id: string; providerId: string; token: string }> {
  const providerId = `test|${new mongoose.Types.ObjectId().toString()}`;
  const user = await UserModel.create({ name, email, role, providerId });
  return { id: String(user._id), providerId, token: signToken(providerId, role) };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await UserModel.deleteMany({});
  await RecipeModel.deleteMany({});
  await MealPlanModel.deleteMany({});
  await GroceryListModel.deleteMany({});
  await PantryItemModel.deleteMany({});
});

describe("Grocery Integration Tests (grocery.test.ts)", () => {
  it("POST /api/v1/grocery-lists/generate — scales, consolidates & subtracts pantry stock", async () => {
    const user = await createUser("Alice", "alice@example.com");

    const recipe = await RecipeModel.create({
      ownerId: new Types.ObjectId(user.id),
      owner: new Types.ObjectId(user.id),
      title: "Spaghetti Bolognese",
      slug: "spaghetti-bolognese",
      difficulty: "easy",
      servings: 2,
      ingredients: [
        { name: "Minced Beef", quantity: 400, unit: "g" },
        { name: "Spaghetti", quantity: 200, unit: "g" },
        { name: "Garlic", quantity: 2, unit: "pcs" },
      ],
      instructions: [{ stepNumber: 1, text: "Cook pasta." }],
    });

    const mealPlan = await MealPlanModel.create({
      userId: user.id,
      name: "Weekly Plan",
      meals: [{ recipeId: recipe._id, servings: 4 }], // 2x scale
    });

    await PantryItemModel.create({
      userId: user.id,
      ingredientKey: "spaghetti",
      name: "Spaghetti",
      quantity: 100,
      unit: "g",
      category: "grains",
    });

    const res = await request(app)
      .post("/api/v1/grocery-lists/generate")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ mealPlanId: String(mealPlan._id) });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Weekly Plan Grocery List");
    expect(res.body.items).toHaveLength(3);

    // Minced Beef: 400 * 2 = 800g
    const beef = res.body.items.find((i: { name: string }) => i.name === "Minced Beef");
    expect(beef.quantity).toBe(800);
    expect(beef.unit).toBe("g");

    // Spaghetti: 200 * 2 = 400g − 100g (pantry) = 300g
    const spaghetti = res.body.items.find((i: { name: string }) => i.name === "Spaghetti");
    expect(spaghetti.quantity).toBe(300);
    expect(spaghetti.unit).toBe("g");

    // Garlic: 2 * 2 = 4 pcs
    const garlic = res.body.items.find((i: { name: string }) => i.name === "Garlic");
    expect(garlic.quantity).toBe(4);
    expect(garlic.unit).toBe("pcs");
  });

  it("POST /api/v1/grocery-lists/:id/recalculate — preserves manual items & flags by key+unit", async () => {
    const user = await createUser("Bob", "bob@example.com");

    const list = await GroceryListModel.create({
      userId: user.id,
      name: "Test List",
      status: "active",
      items: [
        {
          ingredientKey: "garlic",
          name: "Garlic",
          quantity: 2,
          unit: "pcs",
          category: "spices",
          isPurchased: true,
          isManual: false,
        },
        {
          ingredientKey: "olive oil",
          name: "Olive Oil",
          quantity: 1,
          unit: "bottle",
          category: "other",
          isPurchased: false,
          isManual: true, // Manual item
        },
      ],
    });

    const res = await request(app)
      .post(`/api/v1/grocery-lists/${list._id}/recalculate`)
      .set("Authorization", `Bearer ${user.token}`)
      .send({});

    expect(res.status).toBe(200);
    // Manual item should be preserved
    const manualItem = res.body.items.find((i: { isManual: boolean }) => i.isManual);
    expect(manualItem).toBeDefined();
    expect(manualItem.name).toBe("Olive Oil");
  });

  it("POST /api/v1/grocery-lists/:id/purchased-to-pantry — idempotently moves items to pantry", async () => {
    const user = await createUser("Charlie", "charlie@example.com");

    const list = await GroceryListModel.create({
      userId: user.id,
      name: "Pantry Transfer List",
      status: "active",
      items: [
        {
          ingredientKey: "milk",
          name: "Milk",
          quantity: 2,
          unit: "l",
          category: "dairy",
          isPurchased: true,
          movedToPantry: false,
        },
      ],
    });

    const itemId = String(list.items[0]._id);

    // First POST
    const res1 = await request(app)
      .post(`/api/v1/grocery-lists/${list._id}/purchased-to-pantry`)
      .set("Authorization", `Bearer ${user.token}`)
      .send({ itemIds: [itemId] });

    expect(res1.status).toBe(200);
    expect(res1.body.results[0].status).toBe("moved");
    expect(res1.body.list.items[0].movedToPantry).toBe(true);

    // Verify item created in pantry
    const pantryItem = await PantryItemModel.findOne({ userId: user.id, name: "Milk" });
    expect(pantryItem).not.toBeNull();
    expect(pantryItem?.quantity).toBe(2);

    // Second POST (Idempotent double-POST)
    const res2 = await request(app)
      .post(`/api/v1/grocery-lists/${list._id}/purchased-to-pantry`)
      .set("Authorization", `Bearer ${user.token}`)
      .send({ itemIds: [itemId] });

    expect(res2.status).toBe(200);
    expect(res2.body.results[0].status).toBe("skipped_already_moved");

    // Pantry quantity should still be 2 (not duplicated)
    const pantryCount = await PantryItemModel.countDocuments({ userId: user.id, name: "Milk" });
    expect(pantryCount).toBe(1);
  });

  it("Enforces cross-user isolation (404 when accessing another user's list)", async () => {
    const alice = await createUser("Alice", "alice2@example.com");
    const bob = await createUser("Bob", "bob2@example.com");

    const list = await GroceryListModel.create({
      userId: alice.id,
      name: "Alice's Secret List",
      status: "active",
      items: [],
    });

    // Bob attempts to get Alice's list
    const resGet = await request(app)
      .get(`/api/v1/grocery-lists/${list._id}`)
      .set("Authorization", `Bearer ${bob.token}`);
    expect(resGet.status).toBe(404);

    // Bob attempts to update Alice's list
    const resPatch = await request(app)
      .patch(`/api/v1/grocery-lists/${list._id}`)
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ name: "Hacked" });
    expect(resPatch.status).toBe(404);
  });

  it("Returns 400 for malformed IDs and 404 for non-existent lists", async () => {
    const user = await createUser("Dave", "dave@example.com");

    const resInvalidId = await request(app)
      .get("/api/v1/grocery-lists/invalid-id-format")
      .set("Authorization", `Bearer ${user.token}`);
    expect(resInvalidId.status).toBe(400);

    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const resNotFound = await request(app)
      .get(`/api/v1/grocery-lists/${nonExistentId}`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(resNotFound.status).toBe(404);
  });
});

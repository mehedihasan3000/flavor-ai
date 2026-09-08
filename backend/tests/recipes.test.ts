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

async function createUser(
  name: string,
  email: string,
  role: "user" | "admin" = "user",
): Promise<{ id: string; token: string }> {
  // authenticate() looks users up by providerId (the external auth subject),
  // not Mongo _id — must be set for a real request to pass requireAuth.
  const providerId = new mongoose.Types.ObjectId().toString();
  const user = await UserModel.create({ name, email, role, providerId });
  return { id: user._id.toString(), token: signToken(providerId, role) };
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

async function createDraft(token: string) {
  return request(app).post("/api/v1/recipes").set("Authorization", `Bearer ${token}`).send(validRecipeBody);
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

describe("recipe auth guards (FR-AUTH-04/05)", () => {
  it("rejects POST /recipes without a token (401)", async () => {
    const res = await request(app).post("/api/v1/recipes").send(validRecipeBody);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("rejects a malformed/expired token (401)", async () => {
    const res = await request(app)
      .post("/api/v1/recipes")
      .set("Authorization", "Bearer not-a-jwt")
      .send(validRecipeBody);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("rejects PATCH/DELETE without a token (401)", async () => {
    const patch = await request(app).patch("/api/v1/recipes/507f1f77bcf86cd799439011").send({ title: "X" });
    expect(patch.status).toBe(401);

    const del = await request(app).delete("/api/v1/recipes/507f1f77bcf86cd799439011");
    expect(del.status).toBe(401);
  });
});

describe("POST /recipes (FR-RECIPE-01)", () => {
  it("creates a draft owned by the authenticated user", async () => {
    const user = await createUser("Ada", "ada@example.com");
    const res = await createDraft(user.token);

    expect(res.status).toBe(201);
    expect(res.body.recipe).toMatchObject({
      title: validRecipeBody.title,
      slug: validRecipeBody.slug,
      status: "draft",
      source: "manual",
      owner: user.id,
      totalTimeMinutes: 30,
      difficulty: "easy",
    });
    expect(res.body.recipe.ingredients[0].name).toBe("chicken breast");
    expect(res.body.recipe.publishedAt).toBeNull();
    expect(res.body.recipe.id).toBeTruthy();
  });

  it("returns 400 VALIDATION_ERROR for an invalid body", async () => {
    const user = await createUser("Ada", "ada@example.com");
    const res = await request(app)
      .post("/api/v1/recipes")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ title: "X", slug: "x", ingredients: [], steps: [] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 CONFLICT on duplicate slug", async () => {
    const userA = await createUser("Ada", "ada@example.com");
    const userB = await createUser("Bob", "bob@example.com");

    await createDraft(userA.token);
    const res = await createDraft(userB.token);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });
});

describe("GET /recipes/:id visibility (Business Rules 3/4/10)", () => {
  it("returns a published recipe to guests", async () => {
    const owner = await createUser("Ada", "ada@example.com");
    const created = await createDraft(owner.token);
    const id = created.body.recipe.id;

    await request(app).post(`/api/v1/recipes/${id}/publish`).set("Authorization", `Bearer ${owner.token}`);

    const res = await request(app).get(`/api/v1/recipes/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.recipe.status).toBe("published");
  });

  it("hides drafts from guests and other users (404)", async () => {
    const owner = await createUser("Ada", "ada@example.com");
    const stranger = await createUser("Bob", "bob@example.com");
    const created = await createDraft(owner.token);
    const id = created.body.recipe.id;

    const guest = await request(app).get(`/api/v1/recipes/${id}`);
    expect(guest.status).toBe(404);

    const other = await request(app).get(`/api/v1/recipes/${id}`).set("Authorization", `Bearer ${stranger.token}`);
    expect(other.status).toBe(404);
  });

  it("lets the owner and admins read drafts", async () => {
    const owner = await createUser("Ada", "ada@example.com");
    const admin = await createUser("Root", "root@example.com", "admin");
    const created = await createDraft(owner.token);
    const id = created.body.recipe.id;

    const ownerRes = await request(app).get(`/api/v1/recipes/${id}`).set("Authorization", `Bearer ${owner.token}`);
    expect(ownerRes.status).toBe(200);

    const adminRes = await request(app).get(`/api/v1/recipes/${id}`).set("Authorization", `Bearer ${admin.token}`);
    expect(adminRes.status).toBe(200);
  });

  it("returns 400 for a malformed id and 404 for a missing recipe", async () => {
    const bad = await request(app).get("/api/v1/recipes/not-an-id");
    expect(bad.status).toBe(400);

    const missing = await request(app).get("/api/v1/recipes/507f1f77bcf86cd799439011");
    expect(missing.status).toBe(404);
  });
});

describe("PATCH /recipes/:id (FR-RECIPE-03/06)", () => {
  it("lets the owner edit and recomputes totalTimeMinutes", async () => {
    const owner = await createUser("Ada", "ada@example.com");
    const created = await createDraft(owner.token);
    const id = created.body.recipe.id;

    const res = await request(app)
      .patch(`/api/v1/recipes/${id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "Updated Title", cookTimeMinutes: 35 });

    expect(res.status).toBe(200);
    expect(res.body.recipe.title).toBe("Updated Title");
    expect(res.body.recipe.cookTimeMinutes).toBe(35);
    expect(res.body.recipe.totalTimeMinutes).toBe(45);
  });

  it("forbids another user from editing (403)", async () => {
    const owner = await createUser("Ada", "ada@example.com");
    const stranger = await createUser("Bob", "bob@example.com");
    const created = await createDraft(owner.token);
    const id = created.body.recipe.id;

    const res = await request(app)
      .patch(`/api/v1/recipes/${id}`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ title: "Hacked" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });
});

describe("DELETE /recipes/:id (FR-RECIPE-03/06)", () => {
  it("forbids deletion by another user (403)", async () => {
    const owner = await createUser("Ada", "ada@example.com");
    const stranger = await createUser("Bob", "bob@example.com");
    const created = await createDraft(owner.token);
    const id = created.body.recipe.id;

    const res = await request(app)
      .delete(`/api/v1/recipes/${id}`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(res.status).toBe(403);
  });

  it("deletes the recipe for the owner (204) and it is gone (404)", async () => {
    const owner = await createUser("Ada", "ada@example.com");
    const created = await createDraft(owner.token);
    const id = created.body.recipe.id;

    const del = await request(app).delete(`/api/v1/recipes/${id}`).set("Authorization", `Bearer ${owner.token}`);
    expect(del.status).toBe(204);

    const get = await request(app).get(`/api/v1/recipes/${id}`);
    expect(get.status).toBe(404);
  });
});

describe("publish / unpublish (FR-RECIPE-03/04)", () => {
  it("publishes a draft and unpublishes back to draft", async () => {
    const owner = await createUser("Ada", "ada@example.com");
    const created = await createDraft(owner.token);
    const id = created.body.recipe.id;

    const pub = await request(app)
      .post(`/api/v1/recipes/${id}/publish`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(pub.status).toBe(200);
    expect(pub.body.recipe.status).toBe("published");
    expect(pub.body.recipe.publishedAt).toBeTruthy();

    const unpub = await request(app)
      .post(`/api/v1/recipes/${id}/unpublish`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(unpub.status).toBe(200);
    expect(unpub.body.recipe.status).toBe("draft");
    expect(unpub.body.recipe.publishedAt).toBeNull();
  });

  it("publish is idempotent when already published", async () => {
    const owner = await createUser("Ada", "ada@example.com");
    const created = await createDraft(owner.token);
    const id = created.body.recipe.id;

    await request(app).post(`/api/v1/recipes/${id}/publish`).set("Authorization", `Bearer ${owner.token}`);
    const again = await request(app)
      .post(`/api/v1/recipes/${id}/publish`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(again.status).toBe(200);
    expect(again.body.recipe.status).toBe("published");
  });

  it("forbids another user from publishing (403)", async () => {
    const owner = await createUser("Ada", "ada@example.com");
    const stranger = await createUser("Bob", "bob@example.com");
    const created = await createDraft(owner.token);
    const id = created.body.recipe.id;

    const res = await request(app)
      .post(`/api/v1/recipes/${id}/publish`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(res.status).toBe(403);
  });
});
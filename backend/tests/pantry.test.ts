import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { sanitizeMongoOperators } from "../src/middleware/sanitizeInput.js";
import { PantryItemModel } from "../src/models/PantryItem.js";
import { UserModel } from "../src/models/User.js";
import { pantryRouter } from "../src/routes/pantry.js";

/**
 * Pantry integration tests (FEATURES_TASKS.md §A4, Dev A).
 * DB-backed via mongodb-memory-server; auth via real `requireAuth`
 * (users matched by `providerId`, token `sub` = providerId).
 * The router is mounted here exactly as the Lead will mount it in `v1.ts`
 * (`/api/v1/pantry`); `v1.ts` itself is Lead-owned and untouched.
 */

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(sanitizeMongoOperators);
  app.use("/api/v1/pantry", pantryRouter);
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
): Promise<{ token: string }> {
  const providerId = `test|${new mongoose.Types.ObjectId().toString()}`;
  await UserModel.create({ name, email, role, providerId });
  return { token: signToken(providerId, role) };
}

/** `YYYY-MM-DD` string `offsetDays` from today (UTC). */
function ymd(offsetDays: number): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays),
  );
  return d.toISOString().slice(0, 10);
}

const ITEMS = "/api/v1/pantry/items";
const EXPIRING = "/api/v1/pantry/expiring";

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await PantryItemModel.syncIndexes();
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), PantryItemModel.deleteMany({})]);
});

describe("pantry integration (FEATURES_TASKS.md §A4)", () => {
  describe("POST /pantry/items (create)", () => {
    it("creates an item with derived lowStock=false and stored defaults", async () => {
      const { token } = await createUser("Ada", "ada@example.com");

      const res = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Chicken", quantity: 500, unit: "g", category: "meat" });

      expect(res.status).toBe(201);
      expect(res.body.item).toMatchObject({
        name: "Chicken",
        ingredientKey: "chicken",
        quantity: 500,
        unit: "g",
        category: "meat",
        expiryDate: null,
        lowStockThreshold: null,
        lowStock: false,
        notes: "",
      });
      expect(typeof res.body.item.id).toBe("string");
    });

    it("rejects negative quantity with 400", async () => {
      const { token } = await createUser("Ada", "ada@example.com");

      const res = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Chicken", quantity: -5, unit: "g", category: "meat" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a past expiry date with 400", async () => {
      const { token } = await createUser("Ada", "ada@example.com");

      const res = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Milk",
          quantity: 1,
          unit: "l",
          category: "dairy",
          expiryDate: ymd(-1),
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("requires authentication", async () => {
      const res = await request(app)
        .post(ITEMS)
        .send({ name: "Chicken", quantity: 500, unit: "g", category: "meat" });

      expect(res.status).toBe(401);
    });
  });

  describe("duplicates and unit merging", () => {
    it("returns 409 for an exact ingredientKey+unit duplicate", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      const payload = { name: "Chicken", quantity: 500, unit: "g", category: "meat" };
      await request(app).post(ITEMS).set("Authorization", `Bearer ${token}`).send(payload);

      const res = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ ...payload, quantity: 100 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("CONFLICT");
      const list = await request(app).get(ITEMS).set("Authorization", `Bearer ${token}`);
      expect(list.body.total).toBe(1);
      expect(list.body.items[0].quantity).toBe(500);
    });

    it("merges convertible units into the existing line (500g + 1kg → 1500g)", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Chicken", quantity: 500, unit: "g", category: "meat" });

      const res = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "chicken", quantity: 1, unit: "kg", category: "meat" });

      expect(res.status).toBe(200);
      expect(res.body.item).toMatchObject({ quantity: 1500, unit: "g" });
      const list = await request(app).get(ITEMS).set("Authorization", `Bearer ${token}`);
      expect(list.body.total).toBe(1);
    });

    it("keeps incompatible units on separate lines (g vs pcs)", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Flour", quantity: 500, unit: "g", category: "grains" });

      const res = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Flour", quantity: 2, unit: "pcs", category: "grains" });

      expect(res.status).toBe(201);
      const list = await request(app).get(ITEMS).set("Authorization", `Bearer ${token}`);
      expect(list.body.total).toBe(2);
    });
  });

  describe("PATCH /pantry/items/:id (update)", () => {
    it("updates quantity and recomputes the key on rename", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      const created = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Tomato", quantity: 4, unit: "pcs", category: "vegetables" });

      const res = await request(app)
        .patch(`${ITEMS}/${created.body.item.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Potatoes", quantity: 10 });

      expect(res.status).toBe(200);
      expect(res.body.item).toMatchObject({
        name: "Potatoes",
        ingredientKey: "potato",
        quantity: 10,
      });
    });

    it("converts stored quantity on a unit-only change (1000g → 1kg)", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      const created = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Rice", quantity: 1000, unit: "g", category: "grains" });

      const res = await request(app)
        .patch(`${ITEMS}/${created.body.item.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ unit: "kg" });

      expect(res.status).toBe(200);
      expect(res.body.item).toMatchObject({ quantity: 1, unit: "kg" });
    });

    it("rejects an incompatible unit-only change with 400", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      const created = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Rice", quantity: 1000, unit: "g", category: "grains" });

      const res = await request(app)
        .patch(`${ITEMS}/${created.body.item.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ unit: "pcs" });

      expect(res.status).toBe(400);
    });

    it("returns 409 when a rename would fork a duplicate key+unit line", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Tomato", quantity: 4, unit: "pcs", category: "vegetables" });
      const potato = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Potato", quantity: 2, unit: "pcs", category: "vegetables" });

      const res = await request(app)
        .patch(`${ITEMS}/${potato.body.item.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Tomatoes" });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("CONFLICT");
      const list = await request(app).get(ITEMS).set("Authorization", `Bearer ${token}`);
      expect(list.body.total).toBe(2);
    });

    it("returns 404 for another user's item, including admins", async () => {
      const owner = await createUser("Ada", "ada@example.com");
      const other = await createUser("Ben", "ben@example.com");
      const admin = await createUser("Root", "root@example.com", "admin");
      const created = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Chicken", quantity: 500, unit: "g", category: "meat" });

      for (const token of [other.token, admin.token]) {
        const res = await request(app)
          .patch(`${ITEMS}/${created.body.item.id}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ quantity: 1 });
        expect(res.status).toBe(404);
        expect(res.body.code).toBe("NOT_FOUND");
      }
    });

    it("returns 400 for a malformed id", async () => {
      const { token } = await createUser("Ada", "ada@example.com");

      const res = await request(app)
        .patch(`${ITEMS}/not-an-id`)
        .set("Authorization", `Bearer ${token}`)
        .send({ quantity: 1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /pantry/items/:id/use (consume)", () => {
    it("decrements the quantity (500 - 200 = 300)", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      const created = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Chicken", quantity: 500, unit: "g", category: "meat" });

      const res = await request(app)
        .post(`${ITEMS}/${created.body.item.id}/use`)
        .set("Authorization", `Bearer ${token}`)
        .send({ quantity: 200 });

      expect(res.status).toBe(200);
      expect(res.body.item.quantity).toBe(300);
    });

    it("returns 409 with available stock and leaves quantity unchanged", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      const created = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Chicken", quantity: 500, unit: "g", category: "meat" });

      const res = await request(app)
        .post(`${ITEMS}/${created.body.item.id}/use`)
        .set("Authorization", `Bearer ${token}`)
        .send({ quantity: 600 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("CONFLICT");
      expect(res.body.safeMessage).toContain("500");
      const list = await request(app).get(ITEMS).set("Authorization", `Bearer ${token}`);
      expect(list.body.items[0].quantity).toBe(500);
    });

    it("rejects non-positive quantities with 400", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      const created = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Chicken", quantity: 500, unit: "g", category: "meat" });

      for (const quantity of [0, -10]) {
        const res = await request(app)
          .post(`${ITEMS}/${created.body.item.id}/use`)
          .set("Authorization", `Bearer ${token}`)
          .send({ quantity });
        expect(res.status).toBe(400);
      }
    });

    it("returns 404 for another user's item and 400 for a malformed id", async () => {
      const owner = await createUser("Ada", "ada@example.com");
      const other = await createUser("Ben", "ben@example.com");
      const created = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Chicken", quantity: 500, unit: "g", category: "meat" });

      const cross = await request(app)
        .post(`${ITEMS}/${created.body.item.id}/use`)
        .set("Authorization", `Bearer ${other.token}`)
        .send({ quantity: 10 });
      expect(cross.status).toBe(404);

      const malformed = await request(app)
        .post(`${ITEMS}/not-an-id/use`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ quantity: 10 });
      expect(malformed.status).toBe(400);
    });
  });

  describe("DELETE /pantry/items/:id", () => {
    it("removes the item and returns success", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      const created = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Chicken", quantity: 500, unit: "g", category: "meat" });

      const res = await request(app)
        .delete(`${ITEMS}/${created.body.item.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      const list = await request(app).get(ITEMS).set("Authorization", `Bearer ${token}`);
      expect(list.body.total).toBe(0);
    });

    it("returns 404 for another user's item and 400 for a malformed id", async () => {
      const owner = await createUser("Ada", "ada@example.com");
      const other = await createUser("Ben", "ben@example.com");
      const created = await request(app)
        .post(ITEMS)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "Chicken", quantity: 500, unit: "g", category: "meat" });

      const cross = await request(app)
        .delete(`${ITEMS}/${created.body.item.id}`)
        .set("Authorization", `Bearer ${other.token}`);
      expect(cross.status).toBe(404);

      const malformed = await request(app)
        .delete(`${ITEMS}/not-an-id`)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(malformed.status).toBe(400);
    });
  });

  describe("GET /pantry/items (filters)", () => {
    async function seed(token: string) {
      const items = [
        { name: "Chicken", quantity: 500, unit: "g", category: "meat" },
        { name: "Spinach", quantity: 300, unit: "g", category: "vegetables" },
        {
          name: "Milk",
          quantity: 1,
          unit: "l",
          category: "dairy",
          expiryDate: ymd(2),
          lowStockThreshold: 2,
        },
        {
          name: "Rice",
          quantity: 2,
          unit: "kg",
          category: "grains",
          expiryDate: ymd(30),
        },
        { name: "Salt", quantity: 0, unit: "g", category: "spices" },
      ];
      for (const item of items) {
        await request(app).post(ITEMS).set("Authorization", `Bearer ${token}`).send(item);
      }
    }

    it("returns the paginated envelope scoped to the caller", async () => {
      const ada = await createUser("Ada", "ada@example.com");
      const ben = await createUser("Ben", "ben@example.com");
      await seed(ada.token);

      const res = await request(app).get(ITEMS).set("Authorization", `Bearer ${ada.token}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ page: 1, limit: 20, total: 5, totalPages: 1 });
      expect(res.body.items).toHaveLength(5);

      const other = await request(app).get(ITEMS).set("Authorization", `Bearer ${ben.token}`);
      expect(other.body.total).toBe(0);
    });

    it("filters by exact category and case-insensitive name search", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      await seed(token);

      const byCategory = await request(app)
        .get(`${ITEMS}?category=meat`)
        .set("Authorization", `Bearer ${token}`);
      expect(byCategory.body.items.map((i: { name: string }) => i.name)).toEqual(["Chicken"]);

      const bySearch = await request(app)
        .get(`${ITEMS}?q=CHICK`)
        .set("Authorization", `Bearer ${token}`);
      expect(bySearch.body.items.map((i: { name: string }) => i.name)).toEqual(["Chicken"]);
    });

    it("filters expiringWithinDays, excluding null expiries", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      await seed(token);

      const res = await request(app)
        .get(`${ITEMS}?expiringWithinDays=7`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(["Milk"]);
    });

    it("flags low stock only when a threshold is set (null never flags)", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      await seed(token);

      const res = await request(app)
        .get(`${ITEMS}?lowStock=true`)
        .set("Authorization", `Bearer ${token}`);

      // Milk: 1 <= 2 → flagged. Salt has qty 0 but null threshold → never flags.
      expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(["Milk"]);
      expect(res.body.items[0].lowStock).toBe(true);
    });

    it("requires authentication", async () => {
      const res = await request(app).get(ITEMS);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /pantry/expiring", () => {
    it("sorts by expiryDate asc and excludes null expiries", async () => {
      const { token } = await createUser("Ada", "ada@example.com");
      await request(app).post(ITEMS).set("Authorization", `Bearer ${token}`).send({
        name: "Rice",
        quantity: 2,
        unit: "kg",
        category: "grains",
        expiryDate: ymd(30),
      });
      await request(app).post(ITEMS).set("Authorization", `Bearer ${token}`).send({
        name: "Chicken",
        quantity: 500,
        unit: "g",
        category: "meat",
      });
      await request(app).post(ITEMS).set("Authorization", `Bearer ${token}`).send({
        name: "Milk",
        quantity: 1,
        unit: "l",
        category: "dairy",
        expiryDate: ymd(2),
      });

      const res = await request(app).get(EXPIRING).set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(["Milk", "Rice"]);
      expect(res.body).toMatchObject({ page: 1, total: 2 });
    });
  });
});

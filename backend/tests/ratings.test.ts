import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { RatingModel } from "../src/models/Rating.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { ratingsRouter } from "../src/routes/ratings.js";

const { USER_ID, OWNER_ID, RECIPE_ID } = vi.hoisted(() => ({
  USER_ID: "507f1f77bcf86cd799439011",
  OWNER_ID: "507f1f77bcf86cd799439022",
  RECIPE_ID: "507f1f77bcf86cd799439033",
}));

vi.mock("../src/models/Rating.js", () => ({
  RatingModel: {
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndDelete: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock("../src/models/Recipe.js", () => ({
  RecipeModel: {
    findById: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock("../src/middleware/auth.js", () => ({
  requireAuth: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { id: USER_ID, email: "ada@example.com", name: "Ada", role: "user" };
    next();
  },
  requireAdmin: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { id: USER_ID, email: "ada@example.com", name: "Ada", role: "admin" };
    next();
  },
}));

type MockRecipe = {
  _id: string;
  owner: string;
  status: string;
  averageRating: number;
  ratingCount: number;
};

const publishedRecipe = (overrides: Partial<MockRecipe> = {}): MockRecipe => ({
  _id: RECIPE_ID,
  owner: OWNER_ID,
  status: "published",
  averageRating: 0,
  ratingCount: 0,
  ...overrides,
});

const findById = vi.mocked(RecipeModel.findById);
const updateOne = vi.mocked(RecipeModel.updateOne);
const ratingFindOne = vi.mocked(RatingModel.findOne);
const ratingCreate = vi.mocked(RatingModel.create);
const ratingFindOneAndDelete = vi.mocked(RatingModel.findOneAndDelete);
const aggregate = vi.mocked(RatingModel.aggregate);

function mockRecipeFindById(doc: MockRecipe | null): void {
  const lean = vi.fn().mockResolvedValue(doc as never);
  findById.mockReturnValue({ lean } as never);
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/recipes/:id/ratings", ratingsRouter);
  app.use(errorHandler);
  return app;
}

const ratingUrl = `/recipes/${RECIPE_ID}/ratings`;

describe("ratings (FR-RATE-01..05)", () => {
  const app = buildApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRecipeFindById(publishedRecipe());
    updateOne.mockResolvedValue({ acknowledged: true } as never);
    aggregate.mockResolvedValue([{ _id: null, average: 4, count: 1 }] as never);
  });

  describe("GET summary (public)", () => {
    it("returns the stored aggregates for a published recipe", async () => {
      mockRecipeFindById(publishedRecipe({ averageRating: 4.5, ratingCount: 2 }));
      const res = await request(app).get(ratingUrl);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ averageRating: 4.5, ratingCount: 2 });
    });

    it("returns 404 for a draft recipe", async () => {
      mockRecipeFindById(publishedRecipe({ status: "draft" }));
      const res = await request(app).get(ratingUrl);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });

    it("returns 404 for a missing recipe", async () => {
      mockRecipeFindById(null);
      const res = await request(app).get(ratingUrl);
      expect(res.status).toBe(404);
    });

    it("returns 400 for a malformed recipe id", async () => {
      const res = await request(app).get("/recipes/not-an-id/ratings");
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("PUT upsert (authenticated)", () => {
    it("creates a rating and recomputes aggregates", async () => {
      ratingFindOne.mockResolvedValue(null as never);
      ratingCreate.mockResolvedValue({
        _id: "507f1f77bcf86cd799439044",
        recipe: RECIPE_ID,
        user: USER_ID,
        value: 5,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      } as never);

      const res = await request(app).put(ratingUrl).send({ value: 5 });

      expect(res.status).toBe(200);
      expect(ratingCreate).toHaveBeenCalledWith({ recipe: RECIPE_ID, user: USER_ID, value: 5 });
      expect(updateOne).toHaveBeenCalledWith(
        { _id: RECIPE_ID },
        { $set: { averageRating: 4, ratingCount: 1 } },
      );
      expect(res.body.rating).toMatchObject({ recipe: RECIPE_ID, user: USER_ID, value: 5 });
      expect(res.body.summary).toEqual({ averageRating: 4, ratingCount: 1 });
    });

    it("updates an existing rating instead of duplicating (FR-RATE-02)", async () => {
      const save = vi.fn().mockResolvedValue(undefined);
      ratingFindOne.mockResolvedValue({
        _id: "507f1f77bcf86cd799439044",
        recipe: RECIPE_ID,
        user: USER_ID,
        value: 3,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        save,
      } as never);

      const res = await request(app).put(ratingUrl).send({ value: 5 });

      expect(res.status).toBe(200);
      expect(ratingCreate).not.toHaveBeenCalled();
      expect(save).toHaveBeenCalled();
      expect(res.body.rating.value).toBe(5);
    });

    it("forbids the recipe owner from rating their own recipe (FR-RATE-05)", async () => {
      mockRecipeFindById(publishedRecipe({ owner: USER_ID }));
      const res = await request(app).put(ratingUrl).send({ value: 5 });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("rejects an out-of-range rating value (FR-RATE-01)", async () => {
      const res = await request(app).put(ratingUrl).send({ value: 6 });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(ratingCreate).not.toHaveBeenCalled();
    });

    it("returns 404 when rating a non-published recipe", async () => {
      mockRecipeFindById(publishedRecipe({ status: "hidden" }));
      const res = await request(app).put(ratingUrl).send({ value: 5 });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE (authenticated)", () => {
    it("removes the user's rating and recomputes aggregates", async () => {
      ratingFindOneAndDelete.mockResolvedValue({ _id: "rating" } as never);

      const res = await request(app).delete(ratingUrl);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      expect(ratingFindOneAndDelete).toHaveBeenCalledWith({
        recipe: RECIPE_ID,
        user: USER_ID,
      });
      expect(updateOne).toHaveBeenCalled();
    });

    it("returns 404 for a non-published recipe", async () => {
      mockRecipeFindById(publishedRecipe({ status: "draft" }));
      const res = await request(app).delete(ratingUrl);
      expect(res.status).toBe(404);
    });
  });
});
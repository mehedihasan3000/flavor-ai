import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { FavoriteModel } from "../src/models/Favorite.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { favoritesRouter } from "../src/routes/favorites.js";

const { USER_ID, RECIPE_ID, OTHER_RECIPE_ID } = vi.hoisted(() => ({
  USER_ID: "507f1f77bcf86cd799439011",
  RECIPE_ID: "507f1f77bcf86cd799439033",
  OTHER_RECIPE_ID: "507f1f77bcf86cd799439044",
}));

vi.mock("../src/models/Favorite.js", () => ({
  FavoriteModel: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
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
}));

type MockRecipe = { _id: string; status: string };

const publishedRecipe = (overrides: Partial<MockRecipe> = {}): MockRecipe => ({
  _id: RECIPE_ID,
  status: "published",
  ...overrides,
});

const recipeFindById = vi.mocked(RecipeModel.findById);
const recipeUpdateOne = vi.mocked(RecipeModel.updateOne);
const findOne = vi.mocked(FavoriteModel.findOne);
const findOneAndUpdate = vi.mocked(FavoriteModel.findOneAndUpdate);
const findOneAndDelete = vi.mocked(FavoriteModel.findOneAndDelete);
const countDocuments = vi.mocked(FavoriteModel.countDocuments);
const aggregate = vi.mocked(FavoriteModel.aggregate);

function mockRecipeFindById(doc: MockRecipe | null): void {
  const lean = vi.fn().mockResolvedValue(doc as never);
  recipeFindById.mockReturnValue({ lean } as never);
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/favorites", favoritesRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe("favorites (FR-FAV-01..04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecipeFindById(publishedRecipe());
    recipeUpdateOne.mockResolvedValue({ acknowledged: true } as never);
    countDocuments.mockResolvedValue(0);
    aggregate.mockResolvedValue([{ items: [], totalCount: [] }] as never);
  });

  describe("PUT /favorites/:recipeId (authenticated, idempotent)", () => {
    it("adds a favorite and recomputes the favorite count", async () => {
      findOneAndUpdate.mockResolvedValue({
        _id: "507f1f77bcf86cd799439055",
        recipe: RECIPE_ID,
        user: USER_ID,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      } as never);
      countDocuments.mockResolvedValue(1);

      const res = await request(app).put(`/favorites/${RECIPE_ID}`);

      expect(res.status).toBe(200);
      expect(findOneAndUpdate).toHaveBeenCalledWith(
        { recipe: RECIPE_ID, user: USER_ID },
        { $setOnInsert: { recipe: RECIPE_ID, user: USER_ID } },
        { upsert: true, new: true },
      );
      expect(recipeUpdateOne).toHaveBeenCalledWith(
        { _id: RECIPE_ID },
        { $set: { favoriteCount: 1 } },
      );
      expect(res.body.favorite).toMatchObject({ recipe: RECIPE_ID, user: USER_ID });
      expect(res.body.favoriteCount).toBe(1);
    });

    it("is idempotent — re-adding an existing favorite does not duplicate (FR-FAV-02)", async () => {
      findOneAndUpdate.mockResolvedValue({
        _id: "507f1f77bcf86cd799439055",
        recipe: RECIPE_ID,
        user: USER_ID,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      } as never);
      countDocuments.mockResolvedValue(1);

      const res = await request(app).put(`/favorites/${RECIPE_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.favoriteCount).toBe(1);
    });

    it("falls back to the existing row when a concurrent insert wins the upsert race (E11000)", async () => {
      const duplicateKeyError = Object.assign(new Error("dup"), { code: 11000 });
      findOneAndUpdate.mockRejectedValue(duplicateKeyError);
      findOne.mockResolvedValue({
        _id: "507f1f77bcf86cd799439055",
        recipe: RECIPE_ID,
        user: USER_ID,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      } as never);
      countDocuments.mockResolvedValue(1);

      const res = await request(app).put(`/favorites/${RECIPE_ID}`);

      expect(res.status).toBe(200);
      expect(findOne).toHaveBeenCalledWith({ recipe: RECIPE_ID, user: USER_ID });
      expect(res.body.favoriteCount).toBe(1);
    });

    it("returns 404 for a non-published recipe", async () => {
      mockRecipeFindById(publishedRecipe({ status: "draft" }));
      const res = await request(app).put(`/favorites/${RECIPE_ID}`);
      expect(res.status).toBe(404);
      expect(findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("returns 400 for a malformed recipe id", async () => {
      const res = await request(app).put("/favorites/not-an-id");
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("DELETE /favorites/:recipeId (authenticated, idempotent)", () => {
    it("removes the favorite and recomputes the count", async () => {
      findOneAndDelete.mockResolvedValue({ _id: "fav" } as never);
      countDocuments.mockResolvedValue(0);

      const res = await request(app).delete(`/favorites/${RECIPE_ID}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, favoriteCount: 0 });
      expect(findOneAndDelete).toHaveBeenCalledWith({ recipe: RECIPE_ID, user: USER_ID });
    });

    it("succeeds even when no favorite existed (idempotent)", async () => {
      findOneAndDelete.mockResolvedValue(null as never);
      const res = await request(app).delete(`/favorites/${OTHER_RECIPE_ID}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("does not require the recipe to still be published (FR-FAV-04 cleanup)", async () => {
      mockRecipeFindById(null); // recipe deleted entirely
      findOneAndDelete.mockResolvedValue({ _id: "fav" } as never);

      const res = await request(app).delete(`/favorites/${RECIPE_ID}`);

      expect(res.status).toBe(200);
      expect(recipeFindById).not.toHaveBeenCalled();
    });
  });

  describe("GET /favorites (private, paginated)", () => {
    it("returns the caller's favorited published recipes", async () => {
      aggregate.mockResolvedValue([
        {
          items: [
            {
              _id: "507f1f77bcf86cd799439055",
              createdAt: new Date("2026-01-02T00:00:00.000Z"),
              recipe: {
                _id: RECIPE_ID,
                title: "Garlic Spinach Chicken",
                slug: "garlic-spinach-chicken",
                summary: "Quick dinner",
                imageUrl: null,
                difficulty: "easy",
                cuisine: "mediterranean",
                category: "main-course",
                averageRating: 4.5,
                ratingCount: 2,
                favoriteCount: 1,
                commentCount: 0,
                publishedAt: new Date("2026-01-01T00:00:00.000Z"),
              },
            },
          ],
          totalCount: [{ count: 1 }],
        },
      ] as never);

      const res = await request(app).get("/favorites");

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].recipe).toMatchObject({
        id: RECIPE_ID,
        title: "Garlic Spinach Chicken",
        slug: "garlic-spinach-chicken",
      });
      expect(res.body).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it("returns an empty page when nothing is favorited or all favorites were filtered out", async () => {
      const res = await request(app).get("/favorites");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
    });
  });
});

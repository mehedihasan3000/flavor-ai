import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { CommentModel } from "../src/models/Comment.js";
import { FavoriteModel } from "../src/models/Favorite.js";
import { RatingModel } from "../src/models/Rating.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { UserModel } from "../src/models/User.js";
import { adminRouter } from "../src/routes/admin.js";

const { ADMIN_ID, USER_ID, RECIPE_ID, COMMENT_ID } = vi.hoisted(() => ({
  ADMIN_ID: "507f1f77bcf86cd799439099",
  USER_ID: "507f1f77bcf86cd799439011",
  RECIPE_ID: "507f1f77bcf86cd799439033",
  COMMENT_ID: "507f1f77bcf86cd799439044",
}));

vi.mock("../src/models/User.js", () => ({
  UserModel: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock("../src/models/Recipe.js", () => ({
  RecipeModel: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock("../src/models/Comment.js", () => ({
  CommentModel: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("../src/models/Rating.js", () => ({
  RatingModel: {
    deleteMany: vi.fn(),
  },
}));

vi.mock("../src/models/Favorite.js", () => ({
  FavoriteModel: {
    deleteMany: vi.fn(),
  },
}));

vi.mock("../src/middleware/auth.js", () => ({
  requireAdmin: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { id: ADMIN_ID, email: "admin@example.com", name: "Admin", role: "admin" };
    next();
  },
}));

const userFind = vi.mocked(UserModel.find);
const userCountDocuments = vi.mocked(UserModel.countDocuments);
const recipeFind = vi.mocked(RecipeModel.find);
const recipeCountDocuments = vi.mocked(RecipeModel.countDocuments);
const recipeFindById = vi.mocked(RecipeModel.findById);
const recipeFindByIdAndDelete = vi.mocked(RecipeModel.findByIdAndDelete);
const recipeUpdateOne = vi.mocked(RecipeModel.updateOne);
const commentFind = vi.mocked(CommentModel.find);
const commentCountDocuments = vi.mocked(CommentModel.countDocuments);
const commentFindById = vi.mocked(CommentModel.findById);
const commentFindByIdAndDelete = vi.mocked(CommentModel.findByIdAndDelete);
const commentDeleteMany = vi.mocked(CommentModel.deleteMany);
const ratingDeleteMany = vi.mocked(RatingModel.deleteMany);
const favoriteDeleteMany = vi.mocked(FavoriteModel.deleteMany);

function mockChainableFind(model: { find: ReturnType<typeof vi.fn> }, docs: unknown[]): void {
  const lean = vi.fn().mockResolvedValue(docs as never);
  const limit = vi.fn().mockReturnValue({ lean });
  const skip = vi.fn().mockReturnValue({ limit });
  const sort = vi.fn().mockReturnValue({ skip });
  model.find.mockReturnValue({ sort } as never);
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/admin", adminRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

describe("admin moderation (FR-ADMIN-01..04)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userCountDocuments.mockResolvedValue(0);
    mockChainableFind({ find: userFind }, []);
    recipeCountDocuments.mockResolvedValue(0);
    mockChainableFind({ find: recipeFind }, []);
    recipeUpdateOne.mockResolvedValue({ acknowledged: true } as never);
    commentCountDocuments.mockResolvedValue(0);
    mockChainableFind({ find: commentFind }, []);
    commentDeleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 0 } as never);
    ratingDeleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 0 } as never);
    favoriteDeleteMany.mockResolvedValue({ acknowledged: true, deletedCount: 0 } as never);
  });

  describe("GET /admin/users", () => {
    it("returns paginated users", async () => {
      mockChainableFind({ find: userFind }, [
        {
          _id: USER_ID,
          name: "Ada",
          email: "ada@example.com",
          role: "user",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]);
      userCountDocuments.mockResolvedValue(1);

      const res = await request(app).get("/admin/users");

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([
        {
          id: USER_ID,
          name: "Ada",
          email: "ada@example.com",
          avatarUrl: null,
          bio: "",
          role: "user",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]);
      expect(res.body).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it("escapes regex metacharacters in the q filter (NFR-SEC-05)", async () => {
      const res = await request(app).get("/admin/users").query({ q: "a.*(evil)" });
      expect(res.status).toBe(200);
      const filter = userFind.mock.calls[0][0] as { $or: { name: RegExp }[] };
      expect(filter.$or[0].name.source).toBe("a\\.\\*\\(evil\\)");
    });

    it("filters by role", async () => {
      await request(app).get("/admin/users").query({ role: "admin" });
      expect(userFind).toHaveBeenCalledWith({ role: "admin" });
    });
  });

  describe("GET /admin/recipes", () => {
    it("lists recipes including hidden/draft status", async () => {
      await request(app).get("/admin/recipes").query({ status: "hidden" });
      expect(recipeFind).toHaveBeenCalledWith({ status: "hidden" });
    });
  });

  describe("PATCH /admin/recipes/:id", () => {
    it("hides a published recipe", async () => {
      const recipe = {
        _id: RECIPE_ID,
        title: "Garlic Chicken",
        slug: "garlic-chicken",
        owner: USER_ID,
        status: "published",
        publishedAt: new Date("2026-01-01T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        save: vi.fn().mockResolvedValue(undefined),
      };
      recipeFindById.mockResolvedValue(recipe as never);

      const res = await request(app)
        .patch(`/admin/recipes/${RECIPE_ID}`)
        .send({ status: "hidden" });

      expect(res.status).toBe(200);
      expect(recipe.status).toBe("hidden");
      expect(recipe.save).toHaveBeenCalled();
      expect(res.body.recipe.status).toBe("hidden");
    });

    it("restores a hidden recipe and backfills publishedAt if missing", async () => {
      const recipe = {
        _id: RECIPE_ID,
        title: "Garlic Chicken",
        slug: "garlic-chicken",
        owner: USER_ID,
        status: "hidden",
        publishedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        save: vi.fn().mockResolvedValue(undefined),
      };
      recipeFindById.mockResolvedValue(recipe as never);

      const res = await request(app)
        .patch(`/admin/recipes/${RECIPE_ID}`)
        .send({ status: "published" });

      expect(res.status).toBe(200);
      expect(recipe.status).toBe("published");
      expect(recipe.publishedAt).toBeInstanceOf(Date);
    });

    it("rejects a status outside published/hidden (draft stays owner-driven)", async () => {
      const res = await request(app).patch(`/admin/recipes/${RECIPE_ID}`).send({ status: "draft" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(recipeFindById).not.toHaveBeenCalled();
    });

    it("returns 404 for a missing recipe", async () => {
      recipeFindById.mockResolvedValue(null as never);
      const res = await request(app)
        .patch(`/admin/recipes/${RECIPE_ID}`)
        .send({ status: "hidden" });
      expect(res.status).toBe(404);
    });

    it("rejects moderating a draft recipe (draft->published must stay owner-driven)", async () => {
      const recipe = {
        _id: RECIPE_ID,
        title: "Garlic Chicken",
        slug: "garlic-chicken",
        owner: USER_ID,
        status: "draft",
        publishedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        save: vi.fn().mockResolvedValue(undefined),
      };
      recipeFindById.mockResolvedValue(recipe as never);

      const res = await request(app)
        .patch(`/admin/recipes/${RECIPE_ID}`)
        .send({ status: "published" });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("CONFLICT");
      expect(recipe.save).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /admin/recipes/:id", () => {
    it("deletes a recipe and cascades to its ratings/comments/favorites", async () => {
      recipeFindByIdAndDelete.mockResolvedValue({ _id: RECIPE_ID } as never);
      const res = await request(app).delete(`/admin/recipes/${RECIPE_ID}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      expect(recipeFindByIdAndDelete).toHaveBeenCalledWith(RECIPE_ID);
      expect(ratingDeleteMany).toHaveBeenCalledWith({ recipe: RECIPE_ID });
      expect(commentDeleteMany).toHaveBeenCalledWith({ recipe: RECIPE_ID });
      expect(favoriteDeleteMany).toHaveBeenCalledWith({ recipe: RECIPE_ID });
    });

    it("returns 404 for a missing recipe", async () => {
      recipeFindByIdAndDelete.mockResolvedValue(null as never);
      const res = await request(app).delete(`/admin/recipes/${RECIPE_ID}`);
      expect(res.status).toBe(404);
    });
  });

  describe("GET /admin/comments", () => {
    it("filters by recipeId and moderationStatus", async () => {
      await request(app)
        .get("/admin/comments")
        .query({ recipeId: RECIPE_ID, moderationStatus: "moderated" });
      expect(commentFind).toHaveBeenCalledWith({
        recipe: RECIPE_ID,
        moderationStatus: "moderated",
      });
    });
  });

  describe("PATCH /admin/comments/:id", () => {
    it("moderates a comment and recomputes the recipe's comment count", async () => {
      const comment = {
        _id: COMMENT_ID,
        recipe: RECIPE_ID,
        user: USER_ID,
        body: "spam",
        moderationStatus: "visible",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        save: vi.fn().mockResolvedValue(undefined),
      };
      commentFindById.mockResolvedValue(comment as never);
      commentCountDocuments.mockResolvedValue(0);

      const res = await request(app)
        .patch(`/admin/comments/${COMMENT_ID}`)
        .send({ moderationStatus: "moderated" });

      expect(res.status).toBe(200);
      expect(comment.moderationStatus).toBe("moderated");
      expect(comment.save).toHaveBeenCalled();
      expect(commentCountDocuments).toHaveBeenCalledWith({
        recipe: RECIPE_ID,
        moderationStatus: "visible",
      });
      expect(recipeUpdateOne).toHaveBeenCalledWith(
        { _id: RECIPE_ID },
        { $set: { commentCount: 0 } },
      );
    });

    it("returns 404 for a missing comment", async () => {
      commentFindById.mockResolvedValue(null as never);
      const res = await request(app)
        .patch(`/admin/comments/${COMMENT_ID}`)
        .send({ moderationStatus: "moderated" });
      expect(res.status).toBe(404);
    });

    it("rejects an invalid moderationStatus value", async () => {
      const res = await request(app)
        .patch(`/admin/comments/${COMMENT_ID}`)
        .send({ moderationStatus: "banned" });
      expect(res.status).toBe(400);
      expect(commentFindById).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /admin/comments/:id", () => {
    it("deletes a comment and recomputes the recipe's comment count", async () => {
      commentFindByIdAndDelete.mockResolvedValue({
        _id: COMMENT_ID,
        recipe: RECIPE_ID,
      } as never);
      commentCountDocuments.mockResolvedValue(2);

      const res = await request(app).delete(`/admin/comments/${COMMENT_ID}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      expect(recipeUpdateOne).toHaveBeenCalledWith(
        { _id: RECIPE_ID },
        { $set: { commentCount: 2 } },
      );
    });

    it("returns 404 for a missing comment", async () => {
      commentFindByIdAndDelete.mockResolvedValue(null as never);
      const res = await request(app).delete(`/admin/comments/${COMMENT_ID}`);
      expect(res.status).toBe(404);
    });
  });
});

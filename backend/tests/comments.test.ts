import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { requireAuth } from "../src/middleware/auth.js";
import { CommentModel } from "../src/models/Comment.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { commentDetailRouter } from "../src/routes/commentDetail.js";
import { commentsRouter } from "../src/routes/comments.js";

const { USER_ID, OTHER_ID, ADMIN_ID, RECIPE_ID } = vi.hoisted(() => ({
  USER_ID: "507f1f77bcf86cd799439011",
  OTHER_ID: "507f1f77bcf86cd799439022",
  ADMIN_ID: "507f1f77bcf86cd799439099",
  RECIPE_ID: "507f1f77bcf86cd799439033",
}));

vi.mock("../src/models/Comment.js", () => ({
  CommentModel: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock("../src/models/Recipe.js", () => ({
  RecipeModel: {
    findById: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock("../src/middleware/auth.js", () => ({
  requireAuth: vi.fn((req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { id: USER_ID, email: "ada@example.com", name: "Ada", role: "user" };
    next();
  }),
}));

type MockRecipe = { _id: string; owner: string; status: string };
type MockComment = {
  _id: string;
  recipe: string;
  user: string;
  body: string;
  moderationStatus: string;
  createdAt: Date;
  updatedAt: Date;
  save?: () => Promise<unknown>;
};

const publishedRecipe = (overrides: Partial<MockRecipe> = {}): MockRecipe => ({
  _id: RECIPE_ID,
  owner: OTHER_ID,
  status: "published",
  ...overrides,
});

const makeComment = (overrides: Partial<MockComment> = {}): MockComment => ({
  _id: "507f1f77bcf86cd799439044",
  recipe: RECIPE_ID,
  user: USER_ID,
  body: "Great recipe!",
  moderationStatus: "visible",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const recipeFindById = vi.mocked(RecipeModel.findById);
const recipeUpdateOne = vi.mocked(RecipeModel.updateOne);
const find = vi.mocked(CommentModel.find);
const countDocuments = vi.mocked(CommentModel.countDocuments);
const create = vi.mocked(CommentModel.create);
const findById = vi.mocked(CommentModel.findById);
const findByIdAndDelete = vi.mocked(CommentModel.findByIdAndDelete);
const mockedRequireAuth = vi.mocked(requireAuth);

function mockRecipeFindById(doc: MockRecipe | null): void {
  const lean = vi.fn().mockResolvedValue(doc as never);
  recipeFindById.mockReturnValue({ lean } as never);
}

function mockCommentFind(docs: MockComment[]): void {
  const lean = vi.fn().mockResolvedValue(docs as never);
  const populate = vi.fn().mockReturnValue({ lean });
  const limit = vi.fn().mockReturnValue({ populate });
  const skip = vi.fn().mockReturnValue({ limit });
  const sort = vi.fn().mockReturnValue({ skip });
  find.mockReturnValue({ sort } as never);
}

function loginAsAdmin(): void {
  mockedRequireAuth.mockImplementationOnce((req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { id: ADMIN_ID, email: "admin@example.com", name: "Admin", role: "admin" };
    next();
  });
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/recipes/:id/comments", commentsRouter);
  app.use("/comments", commentDetailRouter);
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const listUrl = `/recipes/${RECIPE_ID}/comments`;

describe("comments (FR-COMMENT-01..05)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecipeFindById(publishedRecipe());
    recipeUpdateOne.mockResolvedValue({ acknowledged: true } as never);
    countDocuments.mockResolvedValue(0);
    mockCommentFind([]);
  });

  describe("GET list (public)", () => {
    it("returns paginated visible comments for a published recipe", async () => {
      const comment = makeComment();
      mockCommentFind([comment]);
      countDocuments.mockResolvedValue(1);

      const res = await request(app).get(listUrl);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        id: comment._id,
        recipe: RECIPE_ID,
        user: USER_ID,
        body: "Great recipe!",
        moderationStatus: "visible",
      });
      expect(res.body).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it("includes the populated author's name and avatar (additive fields)", async () => {
      const comment = makeComment({
        user: { _id: USER_ID, name: "Ada", avatarUrl: "https://example.com/a.png" },
      } as unknown as Partial<MockComment>);
      mockCommentFind([comment]);
      countDocuments.mockResolvedValue(1);

      const res = await request(app).get(listUrl);

      expect(res.status).toBe(200);
      expect(res.body.items[0]).toMatchObject({
        user: USER_ID,
        authorName: "Ada",
        authorAvatarUrl: "https://example.com/a.png",
      });
    });

    it("falls back to null author fields when the user reference didn't populate", async () => {
      const comment = makeComment();
      mockCommentFind([comment]);
      countDocuments.mockResolvedValue(1);

      const res = await request(app).get(listUrl);

      expect(res.status).toBe(200);
      expect(res.body.items[0]).toMatchObject({
        user: USER_ID,
        authorName: null,
        authorAvatarUrl: null,
      });
    });

    it("returns 404 for a draft recipe", async () => {
      mockRecipeFindById(publishedRecipe({ status: "draft" }));
      const res = await request(app).get(listUrl);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });

    it("returns 400 for a malformed recipe id", async () => {
      const res = await request(app).get("/recipes/not-an-id/comments");
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST create (authenticated)", () => {
    it("creates a comment and recomputes the recipe's comment count", async () => {
      create.mockResolvedValue(makeComment() as never);

      const res = await request(app).post(listUrl).send({ body: "Great recipe!" });

      expect(res.status).toBe(201);
      expect(create).toHaveBeenCalledWith({
        recipe: RECIPE_ID,
        user: USER_ID,
        body: "Great recipe!",
      });
      expect(countDocuments).toHaveBeenCalledWith({ recipe: RECIPE_ID, moderationStatus: "visible" });
      expect(recipeUpdateOne).toHaveBeenCalledWith(
        { _id: RECIPE_ID },
        { $set: { commentCount: 0 } },
      );
      expect(res.body.comment).toMatchObject({
        recipe: RECIPE_ID,
        user: USER_ID,
        authorName: "Ada",
      });
    });

    it("strips HTML/script tags before storing (NFR-SEC-06)", async () => {
      create.mockResolvedValue(makeComment({ body: "alert(1) Hi" }) as never);

      const res = await request(app)
        .post(listUrl)
        .send({ body: "<script>alert(1)</script>Hi" });

      expect(res.status).toBe(201);
      expect(create).toHaveBeenCalledWith({
        recipe: RECIPE_ID,
        user: USER_ID,
        body: "alert(1) Hi",
      });
    });

    it("rejects a comment that is empty after sanitization (FR-COMMENT-04)", async () => {
      const res = await request(app).post(listUrl).send({ body: "<b></b>" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects a comment over 2000 characters", async () => {
      const res = await request(app).post(listUrl).send({ body: "x".repeat(2001) });
      expect(res.status).toBe(400);
      expect(create).not.toHaveBeenCalled();
    });

    it("returns 404 when commenting on a non-published recipe", async () => {
      mockRecipeFindById(publishedRecipe({ status: "hidden" }));
      const res = await request(app).post(listUrl).send({ body: "Great recipe!" });
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /comments/:id (author only)", () => {
    it("lets the author edit their own comment", async () => {
      const record = makeComment({ save: vi.fn().mockResolvedValue(undefined) });
      findById.mockResolvedValue(record as never);

      const res = await request(app)
        .patch(`/comments/${record._id}`)
        .send({ body: "Updated text" });

      expect(res.status).toBe(200);
      expect(record.body).toBe("Updated text");
      expect(record.save).toHaveBeenCalled();
      expect(res.body.comment.body).toBe("Updated text");
    });

    it("forbids a non-author from editing", async () => {
      const record = makeComment({ user: OTHER_ID, save: vi.fn() });
      findById.mockResolvedValue(record as never);

      const res = await request(app)
        .patch(`/comments/${record._id}`)
        .send({ body: "Hijacked" });

      expect(res.status).toBe(403);
      expect(record.save).not.toHaveBeenCalled();
    });

    it("returns 404 for a missing comment", async () => {
      findById.mockResolvedValue(null as never);
      const res = await request(app)
        .patch(`/comments/${RECIPE_ID}`)
        .send({ body: "Updated text" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /comments/:id (author or admin)", () => {
    it("lets the author delete their own comment and recomputes the count", async () => {
      const record = makeComment();
      findById.mockResolvedValue(record as never);
      findByIdAndDelete.mockResolvedValue(record as never);

      const res = await request(app).delete(`/comments/${record._id}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      expect(findByIdAndDelete).toHaveBeenCalledWith(record._id);
      expect(recipeUpdateOne).toHaveBeenCalled();
    });

    it("forbids a non-author, non-admin from deleting", async () => {
      const record = makeComment({ user: OTHER_ID });
      findById.mockResolvedValue(record as never);

      const res = await request(app).delete(`/comments/${record._id}`);

      expect(res.status).toBe(403);
      expect(findByIdAndDelete).not.toHaveBeenCalled();
    });

    it("lets an admin delete another user's comment (FR-COMMENT-03)", async () => {
      const record = makeComment({ user: OTHER_ID });
      findById.mockResolvedValue(record as never);
      findByIdAndDelete.mockResolvedValue(record as never);
      loginAsAdmin();

      const res = await request(app).delete(`/comments/${record._id}`);

      expect(res.status).toBe(200);
      expect(findByIdAndDelete).toHaveBeenCalledWith(record._id);
    });

    it("returns 404 for a missing comment", async () => {
      findById.mockResolvedValue(null as never);
      const res = await request(app).delete(`/comments/${RECIPE_ID}`);
      expect(res.status).toBe(404);
    });
  });
});

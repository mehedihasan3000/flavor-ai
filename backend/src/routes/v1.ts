import { Router } from "express";
import { getDBState } from "../config/db.js";
import { adminRouter } from "./admin.js";
import { commentDetailRouter } from "./commentDetail.js";
import { commentsRouter } from "./comments.js";
import { favoritesRouter } from "./favorites.js";
import { ratingsRouter } from "./ratings.js";

export const v1Router = Router();

v1Router.get("/health", (_req, res) => {
  const db = getDBState();
  const healthy = db.connected;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    service: "flavorai-api",
    version: "v1",
    database: db,
    timestamp: new Date().toISOString(),
  });
});

// Endpoint groups mounted by workstreams (contract in docs/API_CONTRACT.md):
// M2: /auth, /users
// M3: /recipes, /ai
// M4: /recipes/:id/ratings, /recipes/:id/comments, /favorites, /admin

v1Router.use("/recipes/:id/ratings", ratingsRouter);
v1Router.use("/recipes/:id/comments", commentsRouter);
v1Router.use("/comments", commentDetailRouter);
v1Router.use("/favorites", favoritesRouter);
v1Router.use("/admin", adminRouter);
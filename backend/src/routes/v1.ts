import { Router } from "express";
import { authRouter } from "../controllers/authController.js";
import { getDBState } from "../config/db.js";
import { ratingsRouter } from "./ratings.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { recipesRouter } from "./recipes.js";

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

// M2: Better Auth bridge (tighter rate limit on auth endpoints)
v1Router.use("/auth", authLimiter, authRouter);

// M3: /recipes, /ai
// M4: /recipes/:id/ratings, /recipes/:id/comments, /favorites, /admin

v1Router.use("/recipes/:id/ratings", ratingsRouter);
v1Router.use("/recipes", recipesRouter);

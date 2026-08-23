import { Router } from "express";
import { authRouter } from "../controllers/authController.js";
import { userRouter } from "../controllers/userController.js";
import { getDBState } from "../config/db.js";
import { authLimiter } from "../middleware/rateLimit.js";

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

// M2: Profile & preferences
v1Router.use("/users", userRouter);

// M3: /recipes, /ai
// M4: /recipes/:id/ratings, /recipes/:id/comments, /favorites, /admin
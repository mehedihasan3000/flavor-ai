import { Router } from "express";
import { getDBState } from "../config/db.js";
import { aiRouter } from "./ai.js";
import { recipesRouter } from "./recipes.js";
import { uploadRouter } from "./upload.js";

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

v1Router.use("/recipes", recipesRouter);
v1Router.use("/ai", aiRouter);
v1Router.use("/upload", uploadRouter);

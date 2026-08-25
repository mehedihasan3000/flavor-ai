import { Router } from "express";
import {
  addFavorite,
  getFavoriteStatus,
  listFavorites,
  removeFavorite,
} from "../controllers/favoriteController.js";
import { requireAuth } from "../middleware/auth.js";

export const favoritesRouter = Router();

favoritesRouter.get("/", requireAuth, listFavorites);
favoritesRouter.get("/:recipeId", requireAuth, getFavoriteStatus);
favoritesRouter.put("/:recipeId", requireAuth, addFavorite);
favoritesRouter.delete("/:recipeId", requireAuth, removeFavorite);

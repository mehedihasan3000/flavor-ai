import { Router } from "express";
import { addFavorite, listFavorites, removeFavorite } from "../controllers/favoriteController.js";
import { requireAuth } from "../middleware/auth.js";

export const favoritesRouter = Router();

favoritesRouter.get("/", requireAuth, listFavorites);
favoritesRouter.put("/:recipeId", requireAuth, addFavorite);
favoritesRouter.delete("/:recipeId", requireAuth, removeFavorite);

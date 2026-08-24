import { Router } from "express";
import {
  deleteCommentAdmin,
  deleteRecipeAdmin,
  listAdminComments,
  listAdminRecipes,
  listUsers,
  moderateComment,
  moderateRecipe,
} from "../controllers/adminController.js";
import { requireAdmin } from "../middleware/auth.js";

export const adminRouter = Router();

// Every /admin route requires the admin role (FR-ADMIN-03); non-admin -> 403.
adminRouter.use(requireAdmin);

adminRouter.get("/users", listUsers);

adminRouter.get("/recipes", listAdminRecipes);
adminRouter.patch("/recipes/:id", moderateRecipe);
adminRouter.delete("/recipes/:id", deleteRecipeAdmin);

adminRouter.get("/comments", listAdminComments);
adminRouter.patch("/comments/:id", moderateComment);
adminRouter.delete("/comments/:id", deleteCommentAdmin);

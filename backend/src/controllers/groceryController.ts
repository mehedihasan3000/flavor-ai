import type { Request, Response, NextFunction } from "express";
import mongoose, { Schema, Types } from "mongoose";
import { GroceryListModel } from "../models/GroceryList.js";
import { PantryItemModel } from "../models/PantryItem.js";
import { RecipeModel } from "../models/Recipe.js";
import { upsertPantryFromGrocery } from "../services/pantryService.js";
import {
  consolidateRequirements,
  subtractPantry,
  type GroceryMealRequirements,
} from "../services/groceryService.js";
import { convertQuantity, toBaseUnit } from "../utils/units.js";
import { normalizeIngredientKey } from "../utils/ingredientKey.js";
import { sanitizePlainText } from "../utils/sanitize.js";
import { parseIdParam } from "../utils/params.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * MealPlan model dynamic lookup / fallback for B->C seam compatibility.
 */
const MealPlanModel =
  mongoose.models.MealPlan ||
  mongoose.model(
    "MealPlan",
    new Schema(
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        name: { type: String },
        meals: [
          {
            recipeId: { type: Schema.Types.ObjectId, ref: "Recipe" },
            servings: { type: Number },
            mealType: { type: String },
            date: { type: String },
          },
        ],
      },
      { timestamps: true },
    ),
  );

/**
 * GET /grocery-lists
 * List own grocery lists (paginated envelope).
 */
export async function listGroceryLists(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const status = req.query.status as string | undefined;

    const filter: Record<string, unknown> = { userId: req.user!.id };
    if (status === "active" || status === "archived") {
      filter.status = status;
    }

    const total = await GroceryListModel.countDocuments(filter);
    const items = await GroceryListModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /grocery-lists/:id
 * Detail of single grocery list.
 */
export async function getGroceryList(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const list = await GroceryListModel.findOne({
      _id: id,
      userId: req.user!.id,
    }).exec();

    if (!list) {
      throw ApiError.notFound("Grocery list not found.");
    }

    res.json(list);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /grocery-lists/generate
 * Generate a grocery list from a meal plan.
 * Single-query recipe load, scaling, consolidation, pantry subtraction, saving.
 */
export async function generateFromMealPlan(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { mealPlanId } = req.body;
    const plan = await MealPlanModel.findOne({
      _id: mealPlanId,
      userId: req.user!.id,
    }).exec();

    if (!plan) {
      throw ApiError.notFound("Meal plan not found.");
    }

    const rawMeals = (plan.meals || []) as Array<{
      recipeId?: Types.ObjectId | string;
      servings?: number;
    }>;

    const recipeIds = Array.from(
      new Set(
        rawMeals
          .map((m) => (m.recipeId ? String(m.recipeId) : null))
          .filter((id): id is string => Boolean(id)),
      ),
    ).map((id) => new Types.ObjectId(id));

    const recipes = await RecipeModel.find({ _id: { $in: recipeIds } }).exec();
    const recipeMap = new Map(recipes.map((r) => [String(r._id), r]));

    const mealRequirements: GroceryMealRequirements[] = (
      rawMeals.map((meal): GroceryMealRequirements | null => {
        if (!meal.recipeId) return null;
        const recipe = recipeMap.get(String(meal.recipeId));
        if (!recipe) return null;

        const servingsScale =
          typeof meal.servings === "number" &&
          meal.servings > 0 &&
          recipe.servings > 0
            ? meal.servings / recipe.servings
            : 1;

        return {
          recipeId: String(recipe._id),
          servingsScale,
          ingredients: recipe.ingredients.map(
            (ing: { name: string; quantity?: number | null; unit?: string | null }) => ({
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit,
            }),
          ),
        };
      })
    ).filter((item): item is GroceryMealRequirements => item !== null);

    const consolidated = consolidateRequirements(mealRequirements);
    const pantryItems = await PantryItemModel.find({
      userId: req.user!.id,
    }).exec();
    const { toBuy } = subtractPantry(consolidated, pantryItems);

    const listItems = toBuy.map((item) => {
      const separator = item.key.lastIndexOf("|");
      const ingredientKey =
        separator >= 0
          ? item.key.slice(0, separator)
          : normalizeIngredientKey(item.name);

      return {
        ingredientKey,
        name: sanitizePlainText(item.name),
        quantity: item.quantity,
        unit: sanitizePlainText(item.unit),
        category: item.category,
        sourceRecipeIds: item.sourceRecipeIds.map((id) => new Types.ObjectId(id)),
        isPurchased: false,
        isManual: false,
        estimated: item.estimated,
        movedToPantry: false,
      };
    });

    const planName = typeof plan.name === "string" ? plan.name.trim() : "";
    const name = sanitizePlainText(
      planName ? `${planName} Grocery List` : "Grocery List",
    );

    const newList = await GroceryListModel.create({
      userId: req.user!.id,
      mealPlanId: plan._id,
      name,
      budget: null,
      status: "active",
      items: listItems,
    });

    res.status(201).json(newList);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /grocery-lists/:id/recalculate
 * Re-run consolidate + subtract math, preserving manual items and purchased/movedToPantry flags
 * matched by `ingredientKey` + canonical unit.
 */
export async function recalculate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const list = await GroceryListModel.findOne({
      _id: id,
      userId: req.user!.id,
    }).exec();

    if (!list) {
      throw ApiError.notFound("Grocery list not found.");
    }

    // Flag lookup map keyed by ingredientKey|canonicalUnit
    const flagMap = new Map<
      string,
      { isPurchased: boolean; movedToPantry: boolean }
    >();
    for (const item of list.items) {
      const base = toBaseUnit(item.unit);
      const canonicalUnit = base ? base.base : item.unit.trim().toLowerCase();
      const matchKey = `${item.ingredientKey}|${canonicalUnit}`;
      flagMap.set(matchKey, {
        isPurchased: Boolean(item.isPurchased),
        movedToPantry: Boolean(item.movedToPantry),
      });
    }

    const manualItems = list.items.filter(
      (item: (typeof list.items)[number]) => item.isManual === true,
    );

    if (list.mealPlanId) {
      const plan = await MealPlanModel.findOne({
        _id: list.mealPlanId,
        userId: req.user!.id,
      }).exec();

      if (plan) {
        const rawMeals = (plan.meals || []) as Array<{
          recipeId?: Types.ObjectId | string;
          servings?: number;
        }>;

        const recipeIds = Array.from(
          new Set(
            rawMeals
              .map((m) => (m.recipeId ? String(m.recipeId) : null))
              .filter((id): id is string => Boolean(id)),
          ),
        ).map((id) => new Types.ObjectId(id));

        const recipes = await RecipeModel.find({ _id: { $in: recipeIds } }).exec();
        const recipeMap = new Map(recipes.map((r) => [String(r._id), r]));

        const mealRequirements: GroceryMealRequirements[] = (
          rawMeals.map((meal): GroceryMealRequirements | null => {
            if (!meal.recipeId) return null;
            const recipe = recipeMap.get(String(meal.recipeId));
            if (!recipe) return null;

            const servingsScale =
              typeof meal.servings === "number" &&
              meal.servings > 0 &&
              recipe.servings > 0
                ? meal.servings / recipe.servings
                : 1;

            return {
              recipeId: String(recipe._id),
              servingsScale,
              ingredients: recipe.ingredients.map(
                (ing: { name: string; quantity?: number | null; unit?: string | null }) => ({
                  name: ing.name,
                  quantity: ing.quantity,
                  unit: ing.unit,
                }),
              ),
            };
          })
        ).filter((item): item is GroceryMealRequirements => item !== null);

        const consolidated = consolidateRequirements(mealRequirements);
        const pantryItems = await PantryItemModel.find({
          userId: req.user!.id,
        }).exec();
        const { toBuy } = subtractPantry(consolidated, pantryItems);

        const recalculatedItems = toBuy.map((item) => {
          const separator = item.key.lastIndexOf("|");
          const ingredientKey =
            separator >= 0
              ? item.key.slice(0, separator)
              : normalizeIngredientKey(item.name);
          const base = toBaseUnit(item.unit);
          const canonicalUnit = base ? base.base : item.unit.trim().toLowerCase();
          const matchKey = `${ingredientKey}|${canonicalUnit}`;
          const existingFlags = flagMap.get(matchKey);

          return {
            ingredientKey,
            name: sanitizePlainText(item.name),
            quantity: item.quantity,
            unit: sanitizePlainText(item.unit),
            category: item.category,
            sourceRecipeIds: item.sourceRecipeIds.map((id) => new Types.ObjectId(id)),
            isPurchased: existingFlags ? existingFlags.isPurchased : false,
            isManual: false,
            estimated: item.estimated,
            movedToPantry: existingFlags ? existingFlags.movedToPantry : false,
          };
        });

        list.items = [...recalculatedItems, ...manualItems] as typeof list.items;
      }
    }

    await list.save();
    res.json(list);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /grocery-lists/:id
 * Update list title, budget, or status.
 */
export async function updateList(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const list = await GroceryListModel.findOne({
      _id: id,
      userId: req.user!.id,
    }).exec();

    if (!list) {
      throw ApiError.notFound("Grocery list not found.");
    }

    if (req.body.name !== undefined) {
      list.name = sanitizePlainText(req.body.name);
    }
    if (req.body.budget !== undefined) {
      list.budget = req.body.budget;
    }
    if (req.body.status !== undefined) {
      list.status = req.body.status;
    }

    await list.save();
    res.json(list);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /grocery-lists/:id/items
 * Add a manual item to the list.
 */
export async function addManualItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const list = await GroceryListModel.findOne({
      _id: id,
      userId: req.user!.id,
    }).exec();

    if (!list) {
      throw ApiError.notFound("Grocery list not found.");
    }

    const cleanName = sanitizePlainText(req.body.name);
    const cleanUnit = sanitizePlainText(req.body.unit);
    const ingredientKey = normalizeIngredientKey(cleanName);

    list.items.push({
      ingredientKey,
      name: cleanName,
      quantity: req.body.quantity,
      unit: cleanUnit,
      category: req.body.category,
      sourceRecipeIds: [],
      isPurchased: false,
      isManual: true,
      estimated: false,
      movedToPantry: false,
    } as (typeof list.items)[number]);

    await list.save();
    res.status(201).json(list);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /grocery-lists/:id/items/:itemId
 * Update quantity, unit, category, or purchased flag of an item.
 */
export async function updateItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const itemId = parseIdParam(req.params.itemId, "itemId");
    const list = await GroceryListModel.findOne({
      _id: id,
      userId: req.user!.id,
    }).exec();

    if (!list) {
      throw ApiError.notFound("Grocery list not found.");
    }

    const item = list.items.id(itemId);
    if (!item) {
      throw ApiError.notFound("Grocery item not found.");
    }

    if (req.body.unit !== undefined && req.body.quantity === undefined) {
      const cleanUnit = sanitizePlainText(req.body.unit);
      const converted = convertQuantity(item.quantity, item.unit, cleanUnit);
      if (converted === null) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          "Cannot convert between incompatible units.",
        );
      }
      item.quantity = Math.round((converted + Number.EPSILON) * 1000) / 1000;
      item.unit = cleanUnit;
    }

    if (req.body.quantity !== undefined) {
      item.quantity = req.body.quantity;
    }
    if (req.body.unit !== undefined && req.body.quantity !== undefined) {
      item.unit = sanitizePlainText(req.body.unit);
    }
    if (req.body.category !== undefined) {
      item.category = req.body.category;
    }
    if (req.body.isPurchased !== undefined) {
      item.isPurchased = req.body.isPurchased;
    }

    await list.save();
    res.json(list);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /grocery-lists/:id/items/:itemId
 * Delete an item from the list.
 */
export async function deleteItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const itemId = parseIdParam(req.params.itemId, "itemId");
    const list = await GroceryListModel.findOne({
      _id: id,
      userId: req.user!.id,
    }).exec();

    if (!list) {
      throw ApiError.notFound("Grocery list not found.");
    }

    const item = list.items.id(itemId);
    if (!item) {
      throw ApiError.notFound("Grocery item not found.");
    }

    item.deleteOne();
    await list.save();

    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /grocery-lists/:id/clear-purchased
 * Remove all items marked as purchased.
 */
export async function clearPurchased(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const list = await GroceryListModel.findOne({
      _id: id,
      userId: req.user!.id,
    }).exec();

    if (!list) {
      throw ApiError.notFound("Grocery list not found.");
    }

    list.items = list.items.filter(
      (item: (typeof list.items)[number]) => !item.isPurchased,
    ) as typeof list.items;
    await list.save();

    res.json(list);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /grocery-lists/:id/purchased-to-pantry
 * Move purchased grocery items to user's pantry via Dev-A seam (`upsertPantryFromGrocery`).
 */
export async function purchasedToPantry(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseIdParam(req.params.id);
    const list = await GroceryListModel.findOne({
      _id: id,
      userId: req.user!.id,
    }).exec();

    if (!list) {
      throw ApiError.notFound("Grocery list not found.");
    }

    const itemIdsSet = new Set((req.body.itemIds as string[]).map(String));
    const itemsToProcess = list.items.filter(
      (item: (typeof list.items)[number]) => itemIdsSet.has(String(item._id)),
    );

    const payload = itemsToProcess.map(
      (item: (typeof list.items)[number]) => ({
        groceryItemId: String(item._id),
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        movedToPantry: item.movedToPantry,
      }),
    );

    const results = await upsertPantryFromGrocery(req.user!.id, payload);

    for (const resItem of results) {
      if (resItem.status === "moved") {
        const targetItem = list.items.id(resItem.groceryItemId);
        if (targetItem) {
          targetItem.movedToPantry = true;
        }
      }
    }

    await list.save();
    res.json({ results, list });
  } catch (error) {
    next(error);
  }
}

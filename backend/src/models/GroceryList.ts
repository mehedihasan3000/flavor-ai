import mongoose, { Schema, model, type InferSchemaType } from "mongoose";

/**
 * GroceryList — owned by Dev C (Workstream C, FEATURES_TASKS.md §C2).
 *
 * Deterministic grocery math lives in `services/groceryService.ts`; this
 * model only persists the result. Every query scopes `{ _id, userId }` to
 * `req.user.id` (never a client-supplied `userId`); cross-user access
 * (including admins) is 404. Free-text fields are sanitized in the
 * controller before validation (same as comment/pantry bodies).
 *
 * `mealPlanId` references the Dev-B `MealPlan` model by name only — this
 * file never imports it (B→C seam reads the plan + recipes, §1.4).
 * `budget` is display-only in v1; no `estimatedCost` is stored without real
 * price data (§6). Item subdocs keep their default `_id` so item routes can
 * address `:itemId` via `parseIdParam`.
 */
const groceryItemSchema = new Schema(
  {
    ingredientKey: { type: String, required: true, trim: true, maxlength: 100 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true, maxlength: 30 },
    category: {
      type: String,
      enum: [
        "vegetables",
        "fruits",
        "meat",
        "dairy",
        "grains",
        "spices",
        "frozen",
        "snacks",
        "other",
      ],
      required: true,
    },
    sourceRecipeIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "Recipe" }],
      default: [],
    },
    isPurchased: { type: Boolean, default: false },
    isManual: { type: Boolean, default: false },
    estimated: { type: Boolean, default: false },
    /** Idempotency flag for the C→A `purchased-to-pantry` seam (§1.4). */
    movedToPantry: { type: Boolean, default: false },
  },
  { _id: true },
);

const groceryListSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mealPlanId: { type: Schema.Types.ObjectId, ref: "MealPlan", default: null },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    budget: { type: Number, min: 0, default: null },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    items: { type: [groceryItemSchema], default: [] },
  },
  { timestamps: true },
);

groceryListSchema.index({ userId: 1, createdAt: -1 });

export type GroceryList = InferSchemaType<typeof groceryListSchema>;

export const GroceryListModel =
  mongoose.models.GroceryList || model("GroceryList", groceryListSchema);

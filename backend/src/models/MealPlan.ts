import mongoose, { Schema, model, type InferSchemaType } from "mongoose";

/**
 * MealPlan — owned by Dev B (Workstream B, FEATURES_TASKS.md §B1).
 * Weekly planner (manual + AI) with swap-single-meal / optimize.
 *
 * Ownership: every query scopes `{ _id, userId }` to `req.user.id`
 * (never a client-supplied `userId`); cross-user access is 404
 * (no admin override on meal-plan routes).
 * Slot uniqueness (at most one meal per `(date, mealType)` per plan)
 * is enforced in Zod (create/update refinements), not here, so `swap`
 * addressed by subdoc `_id` (`mealId`) is never ambiguous.
 * `isFavorite` is a flag, not a status — a plan can be both
 * `active` and favorite.
 */
const mealPlanConstraintsSchema = new Schema(
  {
    days: { type: Number, min: 1, max: 7 },
    mealsPerDay: { type: [String], enum: ["breakfast", "lunch", "dinner", "snack", "dessert"] },
    servings: { type: Number, min: 1, max: 20 },
    calorieTarget: { type: Number, min: 1 },
    proteinTargetGrams: { type: Number, min: 1 },
    dietaryLabels: { type: [String], default: undefined },
    cuisine: { type: String, maxlength: 50 },
    budget: { type: Number, min: 0 },
    notes: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const mealSchema = new Schema(
  {
    date: { type: Date, required: true },
    mealType: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack", "dessert"],
      required: true,
    },
    recipeId: { type: Schema.Types.ObjectId, ref: "Recipe", required: true },
    servings: { type: Number, min: 1, max: 20, required: true },
    source: {
      type: String,
      enum: ["manual", "ai", "swap", "optimized"],
      required: true,
      default: "manual",
    },
    notes: { type: String, maxlength: 200 },
  },
  { timestamps: false },
);

const mealPlanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120, default: "My Week" },
    weekStartDate: { type: Date, required: true },
    weekEndDate: { type: Date, required: true },
    status: { type: String, enum: ["active", "archived"], required: true, default: "active" },
    isFavorite: { type: Boolean, required: true, default: false },
    constraints: { type: mealPlanConstraintsSchema, default: null },
    meals: { type: [mealSchema], default: [] },
  },
  { timestamps: true },
);

mealPlanSchema.index({ userId: 1, createdAt: -1 });

export type MealPlan = InferSchemaType<typeof mealPlanSchema>;

export const MealPlanModel = mongoose.models.MealPlan || model("MealPlan", mealPlanSchema);

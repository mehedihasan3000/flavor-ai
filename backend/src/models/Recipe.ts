import mongoose, { Schema, model, type InferSchemaType } from "mongoose";

const ingredientSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    quantity: { type: Number, min: 0 },
    unit: { type: String, maxlength: 30 },
    notes: { type: String, maxlength: 200 },
    pantryMatch: { type: String, enum: ["used", "missing", "substitution"] },
  },
  { _id: false },
);

const stepSchema = new Schema(
  {
    stepNumber: { type: Number, required: true, min: 1 },
    instruction: { type: String, required: true, maxlength: 1000 },
  },
  { _id: false },
);

const nutritionSchema = new Schema(
  {
    caloriesPerServing: { type: Number, min: 0, default: null },
    proteinGramsPerServing: { type: Number, min: 0, default: null },
    carbsGramsPerServing: { type: Number, min: 0, default: null },
    fatGramsPerServing: { type: Number, min: 0, default: null },
    fiberGramsPerServing: { type: Number, min: 0, default: null },
    sugarGramsPerServing: { type: Number, min: 0, default: null },
    sodiumMgPerServing: { type: Number, min: 0, default: null },
  },
  { _id: false },
);

const recipeSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    source: { type: String, enum: ["manual", "ai"], required: true, default: "manual" },
    title: { type: String, required: true, maxlength: 120 },
    slug: { type: String, required: true, maxlength: 160 },
    summary: { type: String, maxlength: 500, default: "" },
    imageUrl: { type: String, maxlength: 500, default: null },
    ingredients: { type: [ingredientSchema], required: true },
    steps: { type: [stepSchema], required: true },
    prepTimeMinutes: { type: Number, min: 0, required: true, default: 0 },
    cookTimeMinutes: { type: Number, min: 0, required: true, default: 0 },
    totalTimeMinutes: { type: Number, min: 0, default: 0 },
    servings: { type: Number, min: 1, max: 20, required: true },
    difficulty: { type: String, enum: ["easy", "medium", "hard"], required: true },
    cuisine: { type: String, maxlength: 50, default: null },
    category: {
      type: String,
      enum: ["main-course", "appetizer", "soup", "salad", "side-dish", "baking", "beverage"],
      default: null,
    },
    tags: { type: [String], default: [] },
    dietaryLabels: { type: [String], default: [] },
    allergenWarnings: { type: [String], default: [] },
    nutrition: { type: nutritionSchema, default: null },
    status: { type: String, enum: ["draft", "published", "hidden"], default: "draft" },
    publishedAt: { type: Date, default: null },
    averageRating: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
    favoriteCount: { type: Number, min: 0, default: 0 },
    commentCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

recipeSchema.index({ slug: 1 }, { unique: true });
recipeSchema.index({ status: 1, publishedAt: -1 });
recipeSchema.index({ owner: 1, createdAt: -1 });
recipeSchema.index({ category: 1, status: 1 });
recipeSchema.index({ cuisine: 1, status: 1 });
recipeSchema.index({ dietaryLabels: 1, status: 1 });
recipeSchema.index(
  { title: "text", summary: "text", "ingredients.name": "text" },
  {
    name: "recipe_text_index",
    weights: { title: 10, summary: 5, "ingredients.name": 3 },
  },
);

recipeSchema.pre("save", function preSave(next) {
  this.totalTimeMinutes = (this.prepTimeMinutes ?? 0) + (this.cookTimeMinutes ?? 0);
  next();
});

export type Recipe = InferSchemaType<typeof recipeSchema>;

export const RecipeModel = mongoose.models.Recipe || model("Recipe", recipeSchema);
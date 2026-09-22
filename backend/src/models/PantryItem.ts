import mongoose, { Schema, model, type InferSchemaType } from "mongoose";

/**
 * PantryItem — owned by Dev A (Workstream A, FEATURES_TASKS.md §A1).
 * Persistent user-scoped pantry foundation for meal planning (Dev B)
 * and grocery subtraction (Dev C).
 *
 * Ownership: every query scopes `{ _id, userId }` to `req.user.id`
 * (never a client-supplied `userId`); cross-user access is 404.
 * `lowStock` is derived (`threshold != null && quantity <= threshold`),
 * never stored.
 */
const pantryItemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
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
    expiryDate: { type: Date, default: null },
    lowStockThreshold: { type: Number, min: 0, default: null },
    notes: { type: String, maxlength: 200, default: "" },
  },
  { timestamps: true },
);

pantryItemSchema.index({ userId: 1, ingredientKey: 1, unit: 1 });
pantryItemSchema.index({ userId: 1, expiryDate: 1 });

export type PantryItem = InferSchemaType<typeof pantryItemSchema>;

export const PantryItemModel =
  mongoose.models.PantryItem || model("PantryItem", pantryItemSchema);

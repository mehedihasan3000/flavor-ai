import { Schema, model, models, type InferSchemaType } from "mongoose";

const favoriteSchema = new Schema(
  {
    recipe: { type: Schema.Types.ObjectId, ref: "Recipe", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

favoriteSchema.index({ recipe: 1, user: 1 }, { unique: true });
favoriteSchema.index({ user: 1, createdAt: -1 });

export type Favorite = InferSchemaType<typeof favoriteSchema>;

export const FavoriteModel = models.Favorite || model("Favorite", favoriteSchema);
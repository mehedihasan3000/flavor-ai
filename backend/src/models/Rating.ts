import mongoose, { Schema, model, type InferSchemaType } from "mongoose";

const ratingSchema = new Schema(
  {
    recipe: { type: Schema.Types.ObjectId, ref: "Recipe", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    value: { type: Number, min: 1, max: 5, required: true },
  },
  { timestamps: true },
);

ratingSchema.index({ recipe: 1, user: 1 }, { unique: true });

export type Rating = InferSchemaType<typeof ratingSchema>;

export const RatingModel = mongoose.models.Rating || model("Rating", ratingSchema);
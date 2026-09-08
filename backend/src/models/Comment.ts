import mongoose, { Schema, model, type InferSchemaType } from "mongoose";

const commentSchema = new Schema(
  {
    recipe: { type: Schema.Types.ObjectId, ref: "Recipe", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, minlength: 1, maxlength: 2000 },
    moderationStatus: { type: String, enum: ["visible", "moderated"], default: "visible" },
  },
  { timestamps: true },
);

commentSchema.index({ recipe: 1, createdAt: 1 });

export type Comment = InferSchemaType<typeof commentSchema>;

export const CommentModel = mongoose.models.Comment || model("Comment", commentSchema);
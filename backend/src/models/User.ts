import { Schema, model, models, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true },
    avatarUrl: { type: String, default: null },
    bio: { type: String, maxlength: 500, default: "" },
    providerId: { type: String, default: null },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    preferences: {
      dietaryLabels: { type: [String], default: [] },
      allergies: { type: [String], default: [] },
      dislikedIngredients: { type: [String], default: [] },
      calorieTarget: { type: Number, default: null },
      calorieRange: {
        min: { type: Number, default: null },
        max: { type: Number, default: null },
      },
      proteinTargetGrams: { type: Number, default: null },
      cookingTimeMaxMinutes: { type: Number, default: null },
      difficulty: { type: String, enum: ["easy", "medium", "hard"], default: null },
    },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ providerId: 1 }, { unique: true, sparse: true });

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = models.User || model("User", userSchema);
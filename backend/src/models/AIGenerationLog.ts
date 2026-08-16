import { Schema, model, models, type InferSchemaType } from "mongoose";

const aiGenerationLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    input: { type: Schema.Types.Mixed, required: true },
    provider: { type: String, required: true, default: "groq" },
    model: { type: String, required: true },
    status: { type: String, enum: ["success", "failed", "timeout"], required: true },
    latencyMs: { type: Number, default: 0 },
    errorCategory: {
      type: String,
      enum: ["provider_error", "invalid_output", "timeout", "rate_limit", "unknown"],
      default: null,
    },
  },
  { timestamps: true },
);

aiGenerationLogSchema.index({ user: 1, createdAt: -1 });

export type AIGenerationLog = InferSchemaType<typeof aiGenerationLogSchema>;

export const AIGenerationLogModel =
  models.AIGenerationLog || model("AIGenerationLog", aiGenerationLogSchema);
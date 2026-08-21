import { ObjectIdString } from "../types/index.js";
import { ApiError } from "./ApiError.js";

/** Validates a route param as a 24-char ObjectId, throwing a 400 envelope otherwise. */
export function parseIdParam(value: string | undefined, field = "id"): string {
  const parsed = ObjectIdString.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", `Invalid ${field}.`, {
      [field]: "Invalid ObjectId",
    });
  }
  return parsed.data;
}
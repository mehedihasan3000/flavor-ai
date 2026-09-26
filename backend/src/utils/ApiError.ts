import type { ZodError } from "zod";
import type { ErrorEnvelope } from "../types/index.js";

export class ApiError extends Error {
  status: number;
  code: ErrorEnvelope["code"];
  validation?: Record<string, string>;

  constructor(
    status: number,
    code: ErrorEnvelope["code"],
    safeMessage: string,
    validation?: Record<string, string>,
  ) {
    super(safeMessage);
    this.status = status;
    this.code = code;
    this.validation = validation;
  }

  static badRequest(message: string, validation?: Record<string, string>): ApiError {
    return new ApiError(400, "VALIDATION_ERROR", message, validation);
  }

  static unauthorized(message = "Authentication required"): ApiError {
    return new ApiError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message = "Access denied"): ApiError {
    return new ApiError(403, "FORBIDDEN", message);
  }

  static notFound(message = "Resource not found"): ApiError {
    return new ApiError(404, "NOT_FOUND", message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, "CONFLICT", message);
  }

  static internal(message = "Internal error"): ApiError {
    return new ApiError(500, "INTERNAL_ERROR", message);
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function toValidationRecord(error: ZodError): Record<string, string> {
  const record: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (path && !record[path]) {
      record[path] = issue.message;
    }
  }
  return record;
}
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isApiError, toValidationRecord } from "../utils/ApiError.js";
import type { ErrorEnvelope } from "../types/index.js";

/**
 * Centralized error handler. Emits the standard envelope
 * `{ status, code, safeMessage, validation? }` and never leaks internals.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  let status = 500;
  let code: ErrorEnvelope["code"] = "INTERNAL_ERROR";
  let safeMessage = "An unexpected error occurred. Please try again.";
  let validation: Record<string, string> | undefined;

  if (err instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    safeMessage = "Invalid input data.";
    validation = toValidationRecord(err);
  } else if (isApiError(err)) {
    status = err.status;
    code = err.code;
    safeMessage = err.message;
    validation = err.validation;
  }

  console.error(`[error] ${status} ${code}: ${safeMessage}`, {
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(status).json({ status, code, safeMessage, validation } satisfies ErrorEnvelope);
}
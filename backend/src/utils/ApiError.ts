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
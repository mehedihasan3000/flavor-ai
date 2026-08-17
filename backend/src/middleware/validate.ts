import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

/**
 * Validates a request body against a Zod schema before it reaches the
 * controller. On failure the ZodError is forwarded to the centralized error
 * handler (mapped to 400 VALIDATION_ERROR).
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}

/** Validates query params against a Zod schema (pagination/filters). */
export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.query = result.data as unknown as Request["query"];
    next();
  };
}

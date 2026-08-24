import type { NextFunction, Request, Response } from "express";

const DANGEROUS_KEY = /^\$|\./;

function stripDangerousKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripDangerousKeys);
  }
  if (value !== null && typeof value === "object") {
    const clean: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (DANGEROUS_KEY.test(key)) continue; // drop Mongo operator (`$gt`, `$where`, ...) / dotted keys
      clean[key] = stripDangerousKeys(nested);
    }
    return clean;
  }
  return value;
}

/**
 * Strips MongoDB operator keys and dotted paths from `req.body`/`req.query`
 * before any handler runs — defense-in-depth against NoSQL injection
 * (NFR-SEC-05). Every M4 controller already funnels input through a Zod
 * schema before it reaches a Mongoose filter, which is the primary guard;
 * this closes the gap for any future endpoint that forgets to.
 */
export function sanitizeMongoOperators(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = stripDangerousKeys(req.body);
  }
  if (req.query && typeof req.query === "object" && Object.keys(req.query).length > 0) {
    req.query = stripDangerousKeys(req.query) as Request["query"];
  }
  next();
}

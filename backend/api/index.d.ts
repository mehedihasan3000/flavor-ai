/**
 * Vercel serverless entry point.
 *
 * Vercel's @vercel/node runtime calls this module's default export as a
 * standard Node.js http.IncomingMessage / ServerResponse handler — which is
 * exactly what an Express app is.  We must NOT call app.listen() here;
 * Vercel manages the HTTP listener itself.
 *
 * The MongoDB connection is cached on the module-level `cached` object so
 * that warm Lambda invocations reuse the existing Mongoose connection instead
 * of opening a new one on every request.
 */
import "dotenv/config";
import type { IncomingMessage, ServerResponse } from "node:http";
export default function handler(req: IncomingMessage, res: ServerResponse): Promise<void>;

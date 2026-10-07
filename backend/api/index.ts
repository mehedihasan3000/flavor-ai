/**
 * Vercel serverless entry point.
 *
 * Vercel's @vercel/node runtime calls this module's default export as a
 * standard Node.js http.IncomingMessage / ServerResponse handler — which is
 * exactly what an Express app is.  We must NOT call app.listen() here;
 * Vercel manages the HTTP listener itself.
 *
 * The MongoDB connection is reused across warm invocations via connectDB()'s
 * internal readyState check — no per-request reconnect.
 */

import "dotenv/config";
import { connectDB } from "../src/config/db.js";
import { createApp } from "../src/server.js";
import type { IncomingMessage, ServerResponse } from "node:http";

const app = createApp();

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    // connectDB() is idempotent: it reuses the existing Mongoose connection
    // on warm invocations (readyState check) instead of reconnecting.
    await connectDB();
  } catch {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        status: 500,
        code: "INTERNAL_ERROR",
        safeMessage: "Database connection failed. Please try again.",
      }),
    );
    return;
  }
  // Express app is a valid http.RequestListener, cast is safe
  (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(
    req,
    res,
  );
}

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
import { connectDB } from "../src/config/db.js";
import { createApp } from "../src/server.js";
import type { IncomingMessage, ServerResponse } from "node:http";

const app = createApp();

let isConnected = false;

async function ensureDB(): Promise<void> {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await ensureDB();
  // Express app is a valid http.RequestListener, cast is safe
  (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(
    req,
    res,
  );
}

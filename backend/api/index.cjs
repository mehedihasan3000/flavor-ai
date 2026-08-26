/**
 * Vercel serverless entry point for the Express backend.
 *
 * This file is plain JavaScript (not TypeScript) so Vercel can execute it
 * directly without a build step. It imports the compiled app from dist/.
 *
 * Mongoose connection is cached globally to reuse across warm invocations
 * (critical for serverless cold starts on Atlas).
 */
const mongoose = require("mongoose");

let isConnected = false;

async function ensureDB() {
  if (isConnected && mongoose.connection.readyState === 1) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  if (mongoose.connection.readyState === 2) {
    await mongoose.connection.asPromise();
  } else {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 30000,
    });
  }
  isConnected = true;
}

// Dynamic import so the TS-compiled modules resolve correctly.
// api/index.js → dist/api/index.js (built output lives in dist/)
let appPromise = null;
function getApp() {
  if (!appPromise) {
    appPromise = import("../dist/server.js").then((m) => m.createApp());
  }
  return appPromise;
}

module.exports = async function handler(req, res) {
  try {
    await ensureDB();
    const app = await getApp();
    app(req, res);
  } catch (err) {
    console.error("[vercel] Error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        status: 500,
        code: "INTERNAL_ERROR",
        safeMessage: "Server error. Please try again.",
      });
    }
  }
};

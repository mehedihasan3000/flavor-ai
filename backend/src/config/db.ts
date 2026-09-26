import mongoose from "mongoose";
import { env } from "./env.js";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Connects to MongoDB, reusing the existing Mongoose connection if one is
 * already open.  This is critical for serverless deployments (Vercel /
 * Lambda) where the module stays in memory across warm invocations — we must
 * not open a new connection on every request.
 *
 * readyState values:
 *   0 = disconnected | 1 = connected | 2 = connecting | 3 = disconnecting
 */
export async function connectDB(): Promise<void> {
  // Already connected — nothing to do.
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // If a connection attempt is already in progress, wait for it rather than
  // racing a second one.
  if (mongoose.connection.readyState === 2) {
    await new Promise<void>((resolve, reject) => {
      mongoose.connection.once("connected", resolve);
      mongoose.connection.once("error", reject);
    });
    return;
  }

  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        autoIndex: env.NODE_ENV !== "production",
        serverSelectionTimeoutMS: 10000,
        // Keep connections alive across serverless warm invocations.
        maxPoolSize: 10,
        socketTimeoutMS: 45000,
      });
      console.log(`[db] Connected to MongoDB (${env.NODE_ENV})`);
      return;
    } catch (err) {
      attempt += 1;
      console.error(
        `[db] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }

  throw new Error(`[db] Could not connect to MongoDB after ${MAX_RETRIES} attempts`);
}

export function getDBState(): {
  connected: boolean;
  readyState: number;
  host?: string;
} {
  return {
    connected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host ?? undefined,
  };
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  console.log("[db] Disconnected from MongoDB");
}
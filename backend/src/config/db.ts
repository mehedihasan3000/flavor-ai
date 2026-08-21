import mongoose from "mongoose";
import { env } from "./env.js";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export async function connectDB(): Promise<void> {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        autoIndex: env.NODE_ENV !== "production",
        serverSelectionTimeoutMS: 10000,
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
/**
 * FlavorAI — Database Index Synchronization Script
 * Usage: npx tsx scripts/syncIndexes.ts
 *
 * In production, Mongoose's `autoIndex` is disabled by design (config/db.ts)
 * to avoid performance penalties and index build locks on startup.
 *
 * This script connects to MongoDB (local or Atlas) via MONGODB_URI and
 * executes `syncIndexes()` on all models:
 *   - User: unique email, sparse unique providerId
 *   - Recipe: unique slug, text index (title, summary, ingredients.name),
 *             status + publishedAt, owner + createdAt
 *   - Rating: unique compound (recipe, user)
 *   - Comment: recipe + createdAt
 *   - Favorite: unique compound (recipe, user)
 *   - AIGenerationLog: user + createdAt
 */

import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { AIGenerationLogModel } from "../src/models/AIGenerationLog.js";
import { CommentModel } from "../src/models/Comment.js";
import { FavoriteModel } from "../src/models/Favorite.js";
import { RatingModel } from "../src/models/Rating.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { UserModel } from "../src/models/User.js";

async function syncAllIndexes(): Promise<void> {
  console.log("==================================================");
  console.log("🔧 FlavorAI — MongoDB Index Synchronization");
  console.log("==================================================");
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Connecting to: ${env.MONGODB_URI.replace(/:\/\/.*@/, "://***@")}\n`);

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log("✅ Connected to MongoDB\n");

  const modelsToSync = [
    { name: "User", model: UserModel },
    { name: "Recipe", model: RecipeModel },
    { name: "Rating", model: RatingModel },
    { name: "Comment", model: CommentModel },
    { name: "Favorite", model: FavoriteModel },
    { name: "AIGenerationLog", model: AIGenerationLogModel },
  ];

  for (const { name, model } of modelsToSync) {
    process.stdout.write(`⏳ Syncing indexes for ${name.padEnd(16)} ... `);
    try {
      await model.syncIndexes();
      const indexes = await model.collection.indexes();
      console.log(`✓ (${indexes.length} indexes verified)`);
    } catch (err) {
      console.log("✗ FAILED");
      console.error(`  Error: ${err instanceof Error ? err.message : err}`);
      throw err;
    }
  }

  console.log("\n==================================================");
  console.log("🎉 All database indexes successfully synchronized!");
  console.log("==================================================");

  await mongoose.disconnect();
  console.log("🔌 Disconnected cleanly from database");
  process.exit(0);
}

syncAllIndexes().catch((err) => {
  console.error("\n❌ Index synchronization failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});

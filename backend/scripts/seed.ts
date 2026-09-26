/**
 * FlavorAI — Demo Seed Script
 * Usage: npx tsx scripts/seed.ts
 *
 * Populates the DB with two demo users (one admin, one regular), three
 * published recipes, a set of ratings, comments, and favorites so the
 * app is immediately usable after a fresh setup.
 *
 * IMPORTANT: Requires backend/.env to be present with a valid MONGODB_URI.
 * Safe to re-run — uses upserts; will not duplicate existing seed docs.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { CommentModel } from "../src/models/Comment.js";
import { FavoriteModel } from "../src/models/Favorite.js";
import { RatingModel } from "../src/models/Rating.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { UserModel } from "../src/models/User.js";
import { hashPassword } from "../src/utils/password.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function upsertUser(data: {
  email: string;
  name: string;
  providerId: string;
  role: "user" | "admin";
  bio: string;
  passwordPlain: string;
}) {
  const { passwordPlain, ...base } = data;
  const passwordHash = await hashPassword(passwordPlain);
  const user = await UserModel.findOneAndUpdate(
    { email: data.email },
    { $setOnInsert: { ...base, passwordHash } },
    { upsert: true, new: true },
  );
  // Upgrade path: existing docs created before password auth have no hash.
  if (!user.passwordHash) {
    user.passwordHash = passwordHash;
    await user.save();
  }
  return user;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const SEED_RECIPES = [
  {
    title: "Pantry Garlic Lemon Chicken",
    summary:
      "A quick weeknight dinner using pantry staples. Juicy chicken breast glazed with garlic, lemon zest, and olive oil — ready in 30 minutes.",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 2,
    difficulty: "easy",
    cuisine: "mediterranean",
    category: "main-course",
    dietaryLabels: ["gluten-free", "high-protein"],
    allergenWarnings: ["none"],
    tags: ["quick", "pantry", "weeknight"],
    ingredients: [
      { name: "Chicken breast", quantity: 2, unit: "pieces", pantryMatch: "used" },
      { name: "Garlic cloves", quantity: 4, unit: "cloves", pantryMatch: "used" },
      { name: "Lemon", quantity: 1, unit: "whole", pantryMatch: "used" },
      { name: "Olive oil", quantity: 2, unit: "tbsp", pantryMatch: "used" },
      { name: "Fresh rosemary", quantity: 2, unit: "sprigs", pantryMatch: "missing" },
    ],
    steps: [
      { stepNumber: 1, instruction: "Pat chicken dry. Season with salt and pepper on both sides." },
      { stepNumber: 2, instruction: "Heat olive oil in a skillet over medium-high heat." },
      { stepNumber: 3, instruction: "Sear chicken 5–6 minutes per side until golden and cooked through (165°F)." },
      { stepNumber: 4, instruction: "Add minced garlic and lemon zest, cook 1 minute." },
      { stepNumber: 5, instruction: "Squeeze lemon juice over chicken and rest 3 minutes before serving." },
    ],
    nutritionEstimate: {
      caloriesPerServing: 320,
      proteinGramsPerServing: 42,
      carbsGramsPerServing: 4,
      fatGramsPerServing: 14,
    },
    source: "ai-generated",
    status: "published",
  },
  {
    title: "Creamy Chickpea Tahini Bowl",
    summary:
      "A plant-based powerhouse bowl with roasted chickpeas, creamy tahini dressing, cucumber, and fresh herbs. Vegan, high-fiber, and deeply satisfying.",
    prepTimeMinutes: 15,
    cookTimeMinutes: 25,
    servings: 2,
    difficulty: "easy",
    cuisine: "middle-eastern",
    category: "main-course",
    dietaryLabels: ["vegan", "vegetarian", "gluten-free", "high-fiber"],
    allergenWarnings: ["sesame"],
    tags: ["bowl", "vegan", "meal-prep", "pantry"],
    ingredients: [
      { name: "Chickpeas (canned)", quantity: 400, unit: "g", pantryMatch: "used" },
      { name: "Tahini", quantity: 3, unit: "tbsp", pantryMatch: "used" },
      { name: "Lemon juice", quantity: 2, unit: "tbsp", pantryMatch: "used" },
      { name: "Garlic", quantity: 1, unit: "clove", pantryMatch: "used" },
      { name: "Cucumber", quantity: 1, unit: "whole", pantryMatch: "missing" },
      { name: "Fresh parsley", quantity: 0.25, unit: "cup", pantryMatch: "missing" },
    ],
    steps: [
      { stepNumber: 1, instruction: "Preheat oven to 400°F (200°C). Drain and dry chickpeas thoroughly." },
      { stepNumber: 2, instruction: "Toss chickpeas with 1 tbsp olive oil, cumin, paprika, salt. Roast 25 min until crispy." },
      { stepNumber: 3, instruction: "Whisk tahini with lemon juice, minced garlic, and 3–4 tbsp water until smooth." },
      { stepNumber: 4, instruction: "Slice cucumber and chop parsley." },
      { stepNumber: 5, instruction: "Assemble bowl: greens, chickpeas, cucumber, drizzle tahini dressing, top with parsley." },
    ],
    nutritionEstimate: {
      caloriesPerServing: 410,
      proteinGramsPerServing: 16,
      carbsGramsPerServing: 48,
      fatGramsPerServing: 18,
    },
    source: "ai-generated",
    status: "published",
  },
  {
    title: "Smoked Salmon Avocado Toast",
    summary:
      "Elevated avocado toast with smoked salmon, capers, red onion, and everything bagel seasoning. Ready in 10 minutes — the ideal high-protein breakfast.",
    prepTimeMinutes: 10,
    cookTimeMinutes: 0,
    servings: 1,
    difficulty: "easy",
    cuisine: "american",
    category: "breakfast",
    dietaryLabels: ["pescatarian", "high-protein"],
    allergenWarnings: ["gluten", "fish"],
    tags: ["breakfast", "quick", "brunch"],
    ingredients: [
      { name: "Sourdough bread", quantity: 2, unit: "slices", pantryMatch: "used" },
      { name: "Avocado", quantity: 1, unit: "whole", pantryMatch: "used" },
      { name: "Smoked salmon", quantity: 80, unit: "g", pantryMatch: "missing" },
      { name: "Capers", quantity: 1, unit: "tbsp", pantryMatch: "missing" },
      { name: "Red onion", quantity: 0.25, unit: "small", pantryMatch: "missing" },
      { name: "Lemon", quantity: 0.5, unit: "whole", pantryMatch: "used" },
    ],
    steps: [
      { stepNumber: 1, instruction: "Toast sourdough slices until golden and crispy." },
      { stepNumber: 2, instruction: "Mash avocado with lemon juice, salt, and pepper." },
      { stepNumber: 3, instruction: "Spread mashed avocado generously on each slice." },
      { stepNumber: 4, instruction: "Top with smoked salmon, capers, and thinly sliced red onion." },
      { stepNumber: 5, instruction: "Finish with a squeeze of lemon and everything bagel seasoning." },
    ],
    nutritionEstimate: {
      caloriesPerServing: 460,
      proteinGramsPerServing: 28,
      carbsGramsPerServing: 36,
      fatGramsPerServing: 22,
    },
    source: "ai-generated",
    status: "published",
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  console.log("🌱 FlavorAI Seed Script");
  console.log("Connecting to MongoDB:", env.MONGODB_URI.replace(/:\/\/.*@/, "://***@"));

  await mongoose.connect(env.MONGODB_URI);
  console.log("✅ Connected\n");

  // --- Users ---
  // .com accounts match the Demo User / Demo Admin quick-sign-in buttons
  // (sign-in page). .demo accounts are kept for backward compatibility.
  console.log("👤 Seeding users...");
  const adminUser = await upsertUser({
    email: "admin@flavorai.demo",
    name: "FlavorAI Admin",
    providerId: "demo-admin-001",
    role: "admin",
    bio: "Platform administrator. Curates quality recipes and moderates content.",
    passwordPlain: "admin123456",
  });

  const regularUser = await upsertUser({
    email: "chef@flavorai.demo",
    name: "Chef Alex",
    providerId: "demo-user-001",
    role: "user",
    bio: "Home cook passionate about Mediterranean and Middle Eastern flavors.",
    passwordPlain: "password123",
  });

  const demoAdminCom = await upsertUser({
    email: "admin@flavorai.com",
    name: "FlavorAI Admin",
    providerId: `usr_${Buffer.from("admin@flavorai.com").toString("hex").slice(0, 24)}`,
    role: "admin",
    bio: "Platform administrator. Curates quality recipes and moderates content.",
    passwordPlain: "admin123456",
  });

  const demoUserCom = await upsertUser({
    email: "chef@flavorai.com",
    name: "Chef Alex",
    providerId: `usr_${Buffer.from("chef@flavorai.com").toString("hex").slice(0, 24)}`,
    role: "user",
    bio: "Home cook passionate about Mediterranean and Middle Eastern flavors.",
    passwordPlain: "password123",
  });

  console.log(`  ✓ admin@flavorai.demo (id: ${adminUser._id})`);
  console.log(`  ✓ chef@flavorai.demo (id: ${regularUser._id})`);
  console.log(`  ✓ admin@flavorai.com (id: ${demoAdminCom._id})`);
  console.log(`  ✓ chef@flavorai.com (id: ${demoUserCom._id})\n`);

  // --- Recipes ---
  console.log("🍽️  Seeding recipes...");
  const createdRecipes: mongoose.Document[] = [];

  for (const recipeData of SEED_RECIPES) {
    const recipeSlug = toSlug(recipeData.title);
    const existing = await RecipeModel.findOne({ slug: recipeSlug });

    if (existing) {
      console.log(`  ⟳ Skipped (exists): ${recipeData.title}`);
      createdRecipes.push(existing);
      continue;
    }

    const recipe = await RecipeModel.create({
      ...recipeData,
      slug: recipeSlug,
      owner: adminUser._id,
      publishedAt: new Date(),
      totalTimeMinutes: recipeData.prepTimeMinutes + recipeData.cookTimeMinutes,
    });

    console.log(`  ✓ Created: ${recipe.title} (slug: ${recipe.slug})`);
    createdRecipes.push(recipe);
  }

  // --- Ratings ---
  console.log("\n⭐ Seeding ratings...");
  for (const recipe of createdRecipes) {
    const recipeId = (recipe as { _id: mongoose.Types.ObjectId })._id;

    await RatingModel.findOneAndUpdate(
      { recipe: recipeId, user: regularUser._id },
      { recipe: recipeId, user: regularUser._id, value: 5 },
      { upsert: true },
    );

    const agg = await RatingModel.aggregate([
      { $match: { recipe: new mongoose.Types.ObjectId(recipeId.toString()) } },
      { $group: { _id: null, avg: { $avg: "$value" }, count: { $sum: 1 } } },
    ]);
    const { avg = 0, count = 0 } = agg[0] ?? {};
    await RecipeModel.findByIdAndUpdate(recipeId, {
      averageRating: Math.round(avg * 10) / 10,
      ratingCount: count,
    });
  }
  console.log(`  ✓ Seeded ${createdRecipes.length} ratings (5★ each)`);

  // --- Comments ---
  console.log("\n💬 Seeding comments...");
  const commentBodies = [
    "Made this last night — absolutely delicious! The lemon zest really brightens the flavor.",
    "Love how simple yet satisfying this is. Perfect for meal prep!",
    "Tried this for Sunday brunch and my family couldn't get enough. Will definitely make again!",
  ];

  for (let i = 0; i < createdRecipes.length; i++) {
    const recipeId = (createdRecipes[i] as { _id: mongoose.Types.ObjectId })._id;
    const existingComment = await CommentModel.findOne({
      recipe: recipeId,
      user: regularUser._id,
    });

    if (!existingComment) {
      await CommentModel.create({
        recipe: recipeId,
        user: regularUser._id,
        body: commentBodies[i] ?? "Great recipe!",
        moderationStatus: "visible",
      });

      const commentCount = await CommentModel.countDocuments({
        recipe: recipeId,
        moderationStatus: "visible",
      });
      await RecipeModel.findByIdAndUpdate(recipeId, { commentCount });
    }
  }
  console.log(`  ✓ Seeded ${createdRecipes.length} comments`);

  // --- Favorites ---
  console.log("\n❤️  Seeding favorites...");
  for (const recipe of createdRecipes) {
    const recipeId = (recipe as { _id: mongoose.Types.ObjectId })._id;

    await FavoriteModel.findOneAndUpdate(
      { recipe: recipeId, user: regularUser._id },
      { recipe: recipeId, user: regularUser._id },
      { upsert: true },
    );

    const favoriteCount = await FavoriteModel.countDocuments({ recipe: recipeId });
    await RecipeModel.findByIdAndUpdate(recipeId, { favoriteCount });
  }
  console.log(`  ✓ Seeded ${createdRecipes.length} favorites`);

  console.log("\n🎉 Seed complete!\n");
  console.log("Demo accounts (sign in with email + password):");
  console.log("  Admin  → email: admin@flavorai.com  password: admin123456");
  console.log("  User   → email: chef@flavorai.com   password: password123");
  console.log("  (Legacy .demo addresses work with the same passwords.)");

  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});

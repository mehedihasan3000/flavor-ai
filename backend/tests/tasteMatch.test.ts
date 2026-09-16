import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RecipeModel } from "../src/models/Recipe.js";
import { UserModel } from "../src/models/User.js";
import { matchRecipesToTaste } from "../src/services/aiService.js";
import { ApiError } from "../src/utils/ApiError.js";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  // The candidate-selection $text query needs the recipe_text_index built
  // before it can run — wait for Mongoose's autoIndex to finish creating it.
  await RecipeModel.init();
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
  }
});

beforeEach(async () => {
  await Promise.all([RecipeModel.deleteMany({}), UserModel.deleteMany({})]);
});

async function seedPublishedRecipe(overrides: Partial<Record<string, unknown>> & { title: string; slug: string }) {
  const owner = new mongoose.Types.ObjectId();
  const recipe = await RecipeModel.create({
    owner,
    source: "manual",
    ingredients: [{ name: "placeholder" }],
    steps: [{ stepNumber: 1, instruction: "Cook it." }],
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    servings: 2,
    difficulty: "easy",
    status: "published",
    publishedAt: new Date(),
    ...overrides,
  });
  return recipe;
}

function mockGroqMatches(matches: Array<{ recipeId: string; score: number; matchedTastes?: string[]; reason: string }>) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({ matches }) } }],
    }),
  } as Response);
}

describe("aiService.matchRecipesToTaste — candidate selection & AI reranking (FR-TASTE-01..03)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns an empty match list without calling the AI when no recipes are published", async () => {
    globalThis.fetch = vi.fn();

    const result = await matchRecipesToTaste({ tastes: ["spicy"], limit: 10 });

    expect(result.matches).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("selects a keyword-relevant candidate and hydrates the full recipe on the AI's response", async () => {
    const spicyRecipe = await seedPublishedRecipe({
      title: "Spicy Thai Curry",
      slug: "spicy-thai-curry",
      tags: ["spicy", "curry"],
      summary: "A fiery red curry with chili and coconut milk.",
    });
    await seedPublishedRecipe({
      title: "Vanilla Sponge Cake",
      slug: "vanilla-sponge-cake",
      tags: ["sweet", "dessert"],
      summary: "A light and fluffy vanilla cake.",
    });

    mockGroqMatches([
      {
        recipeId: spicyRecipe._id.toString(),
        score: 92,
        matchedTastes: ["spicy"],
        reason: "Loaded with chili and curry paste for a strong spicy kick.",
      },
    ]);

    const result = await matchRecipesToTaste({ tastes: ["spicy"], limit: 10 });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].recipe.title).toBe("Spicy Thai Curry");
    expect(result.matches[0].score).toBe(92);
    expect(result.matches[0].matchedTastes).toEqual(["spicy"]);
  });

  it("discards a recipeId the AI hallucinates outside the offered candidate pool", async () => {
    const realRecipe = await seedPublishedRecipe({
      title: "Umami Miso Ramen",
      slug: "umami-miso-ramen",
      tags: ["umami", "savory"],
    });
    const fakeId = new mongoose.Types.ObjectId().toString();

    mockGroqMatches([
      { recipeId: realRecipe._id.toString(), score: 88, matchedTastes: ["umami"], reason: "Rich miso broth." },
      { recipeId: fakeId, score: 99, matchedTastes: ["umami"], reason: "Hallucinated recipe." },
    ]);

    const result = await matchRecipesToTaste({ tastes: ["umami"], limit: 10 });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].recipe.id).toBe(realRecipe._id.toString());
  });

  it("falls back to recently published recipes when keyword matches are too sparse", async () => {
    const unrelated = await seedPublishedRecipe({
      title: "Plain Steamed Rice",
      slug: "plain-steamed-rice",
    });

    mockGroqMatches([
      { recipeId: unrelated._id.toString(), score: 40, matchedTastes: [], reason: "Neutral flavor, weak match." },
    ]);

    const result = await matchRecipesToTaste({ tastes: ["bitter"], limit: 10 });

    expect(globalThis.fetch).toHaveBeenCalled();
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].recipe.title).toBe("Plain Steamed Rice");
  });

  it("throws 502 AI_PROVIDER_ERROR when the AI response fails schema validation", async () => {
    await seedPublishedRecipe({ title: "Spicy Tacos", slug: "spicy-tacos", tags: ["spicy"] });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ matches: [{ score: "not-a-number" }] }) } }],
      }),
    } as Response);

    await expect(matchRecipesToTaste({ tastes: ["spicy"], limit: 10 })).rejects.toThrowError(ApiError);
    await expect(matchRecipesToTaste({ tastes: ["spicy"], limit: 10 })).rejects.toMatchObject({
      status: 502,
      code: "AI_PROVIDER_ERROR",
    });
  });
});

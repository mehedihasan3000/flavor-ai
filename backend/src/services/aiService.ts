import { env } from "../config/env.js";
import { AIGenerationLogModel } from "../models/AIGenerationLog.js";
import {
  AIRecipeOutputSchema,
  FlavorPairingSuggestionSchema,
  FoodPhotoAnalysisResult,
  type AIRecipeOutput,
  type AIRecipePromptInput,
  type FlavorPairingInput,
  type FlavorPairingSuggestion,
  type FoodPhotoAnalysisInput,
  type IngredientInput,
  type PantryMatchResult,
  type RecipeIngredient,
} from "../types/index.js";
import { validateImageInput } from "./imageService.js";
import { ApiError } from "../utils/ApiError.js";
import { z } from "zod";

const FlavorPairingOutputSchema = z.object({
  suggestions: z.array(FlavorPairingSuggestionSchema),
});

/**
 * Normalizes an ingredient name string for matching.
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "");
}

/**
 * Compares user input ingredients against recipe ingredients to mark used/missing ingredients.
 * (FR-PANTRY-01..03)
 */
export function matchPantry(
  inputIngredients: (string | IngredientInput)[],
  recipeIngredients: RecipeIngredient[],
): PantryMatchResult {
  const normalizedInputs = inputIngredients.map((item) => {
    const rawName = typeof item === "string" ? item : item.name;
    return {
      raw: rawName,
      normalized: normalizeIngredientName(rawName),
    };
  });

  const usedSet = new Set<string>();
  const missingSet = new Set<string>();

  for (const item of recipeIngredients) {
    const normName = normalizeIngredientName(item.name);
    const matchedInput = normalizedInputs.find(
      (inp) =>
        normName === inp.normalized ||
        normName.includes(inp.normalized) ||
        inp.normalized.includes(normName),
    );

    if (matchedInput) {
      item.pantryMatch = "used";
      usedSet.add(item.name);
    } else {
      item.pantryMatch = "missing";
      missingSet.add(item.name);
    }
  }

  const usedIngredients = Array.from(usedSet);
  const missingIngredients = Array.from(missingSet);

  return {
    usedIngredients,
    missingIngredients,
    usageCount: usedIngredients.length,
    missingCount: missingIngredients.length,
  };
}

/**
 * Constructs prompt enforcing strict JSON recipe output conforming to AIRecipeOutputSchema.
 */
export function buildRecipePrompt(input: AIRecipePromptInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are FlavorAI, an expert culinary assistant and master chef.
Your task is to generate a detailed, delicious recipe based on the user's available ingredients, dietary rules, and preferences.

CRITICAL INSTRUCTIONS:
1. Return ONLY a single valid JSON object. Do NOT wrap the JSON in markdown fences (e.g. no \`\`\`json).
2. The output MUST conform strictly to this JSON structure:
{
  "title": string (3-120 chars),
  "summary": string (max 500 chars),
  "ingredients": [
    { "name": string, "quantity": number (optional), "unit": string (optional), "notes": string (optional) }
  ],
  "steps": [
    { "stepNumber": number (1-indexed integer), "instruction": string (3-1000 chars) }
  ],
  "prepTimeMinutes": integer >= 0,
  "cookTimeMinutes": integer >= 0,
  "servings": integer (1-20),
  "difficulty": "easy" | "medium" | "hard",
  "cuisine": string (optional, e.g. "italian", "mediterranean"),
  "category": "main-course" | "appetizer" | "soup" | "salad" | "side-dish" | "baking" | "beverage" (optional),
  "tags": string[] (optional),
  "dietaryLabels": Array<"vegetarian" | "vegan" | "halal" | "gluten-free" | "dairy-free" | "high-protein" | "low-carb" | "keto">,
  "allergenWarnings": string[],
  "nutrition": {
    "caloriesPerServing": number | null,
    "proteinGramsPerServing": number | null,
    "carbsGramsPerServing": number | null,
    "fatGramsPerServing": number | null,
    "fiberGramsPerServing": number | null (optional),
    "sugarGramsPerServing": number | null (optional),
    "sodiumMgPerServing": number | null (optional)
  } (optional, set values to null if unknown - NEVER fabricate accurate numbers)
}
3. Strictly respect all allergies, dietary restrictions, and excluded ingredients. Never include prohibited ingredients!`;

  const ingredientList = input.ingredients
    .map((ing) => {
      if (typeof ing === "string") return ing;
      return `${ing.quantity ?? ""} ${ing.unit ?? ""} ${ing.name}`.trim();
    })
    .join(", ");

  const promptDetails: string[] = [
    `Primary available ingredients: ${ingredientList}`,
    `Servings requested: ${input.servings}`,
  ];

  if (input.mealType) promptDetails.push(`Meal type: ${input.mealType}`);
  if (input.cuisine) promptDetails.push(`Cuisine style: ${input.cuisine}`);
  if (input.maxCookingTimeMinutes)
    promptDetails.push(`Maximum cooking time: ${input.maxCookingTimeMinutes} minutes`);
  if (input.difficulty) promptDetails.push(`Target difficulty: ${input.difficulty}`);
  if (input.availableEquipment && input.availableEquipment.length > 0)
    promptDetails.push(`Available kitchen equipment: ${input.availableEquipment.join(", ")}`);
  if (input.excludedIngredients && input.excludedIngredients.length > 0)
    promptDetails.push(`EXCLUDED ingredients (DO NOT USE): ${input.excludedIngredients.join(", ")}`);

  if (input.preferences) {
    const prefs = input.preferences;
    if (prefs.dietaryLabels && prefs.dietaryLabels.length > 0)
      promptDetails.push(`Dietary labels required: ${prefs.dietaryLabels.join(", ")}`);
    if (prefs.allergies && prefs.allergies.length > 0)
      promptDetails.push(`ALLERGIES (CRITICAL - DO NOT INCLUDE): ${prefs.allergies.join(", ")}`);
    if (prefs.dislikedIngredients && prefs.dislikedIngredients.length > 0)
      promptDetails.push(`Disliked ingredients to avoid: ${prefs.dislikedIngredients.join(", ")}`);
    if (prefs.calorieTarget) promptDetails.push(`Target calories per serving: ~${prefs.calorieTarget}`);
    if (prefs.proteinTargetGrams) promptDetails.push(`Target protein per serving: ~${prefs.proteinTargetGrams}g`);
  }

  const userPrompt = `Generate a recipe using the following details:\n- ${promptDetails.join("\n- ")}`;

  return { systemPrompt, userPrompt };
}

/**
 * Constructs prompt for flavor pairing suggestions.
 */
export function buildFlavorPairingPrompt(input: FlavorPairingInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are FlavorAI, a world-class culinary scientist and flavor expert.
Given a target ingredient, suggest 3-6 complementary ingredients (type: "addition") and smart culinary substitutions (type: "substitution").

CRITICAL INSTRUCTIONS:
1. Return ONLY a single valid JSON object:
{
  "suggestions": [
    {
      "ingredient": string,
      "reason": string,
      "type": "addition" | "substitution"
    }
  ]
}
2. Ensure recommendations strictly honor all dietary labels and allergies provided.`;

  const details: string[] = [`Target ingredient: ${input.ingredient}`];
  if (input.preferences) {
    if (input.preferences.dietaryLabels?.length) {
      details.push(`Dietary labels: ${input.preferences.dietaryLabels.join(", ")}`);
    }
    if (input.preferences.allergies?.length) {
      details.push(`Allergies to avoid: ${input.preferences.allergies.join(", ")}`);
    }
  }

  const userPrompt = `Suggest flavor pairings and substitutions for:\n- ${details.join("\n- ")}`;

  return { systemPrompt, userPrompt };
}

/**
 * Extracts the first balanced `{...}` JSON object using brace counting that
 * is aware of string literals and escapes. Returns null when the payload is
 * truncated (no balanced close) or contains no object at all.
 */
function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          return text.slice(start, i + 1);
        }
      }
    }
  }
  return null;
}

/**
 * Removes common non-JSON artefacts reasoning/vision models emit:
 * trailing commas, JS-style comments. Deliberately does NOT rewrite
 * single quotes (would corrupt apostrophes like "farmer's").
 */
function repairJsonArtefacts(json: string): string {
  return json
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\n)\s*\/\/[^\n]*/g, "$1")
    .replace(/,(\s*[}\]])/g, "$1");
}

/**
 * Clean markdown code block formatting if present in raw model string output.
 *
 * Handles the failure modes actually observed from qwen vision models:
 * - `<think>...</think>` reasoning dumps (can be larger than the JSON itself)
 * - prose before/after the JSON ("Here is your analysis: ...")
 * - fenced blocks anywhere in the text, not just at offset 0
 * - trailing commas / comments that break strict JSON.parse
 */
function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim();
  // Strip extended-thinking <think>...</think> blocks emitted by reasoning models
  // (e.g. qwen/qwen3.x). Also handle the <thinking> variant.
  cleaned = cleaned
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .trim();
  // Extract fenced code block wherever it appears ("Here is the JSON:\n```json...")
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]?.trim()) {
    cleaned = fenceMatch[1].trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  // Prefer a balanced-object extraction: immune to trailing prose and to
  // merging two adjacent objects (first-{ to last-} would glue them together).
  const balanced = extractBalancedJsonObject(cleaned);
  if (balanced) {
    return repairJsonArtefacts(balanced).trim();
  }
  // Fallback: first "{" to last "}" (may still be truncated — caller detects).
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    return repairJsonArtefacts(cleaned.slice(jsonStart, jsonEnd + 1)).trim();
  }
  return repairJsonArtefacts(cleaned).trim();
}

/**
 * Tries strict JSON.parse first, then the repaired variant.
 * Returns the parsed value or throws — callers map this to a retryable 502.
 */
function tryParseModelJson(cleaned: string): unknown {
  try {
    return JSON.parse(cleaned);
  } catch {
    // cleanJsonResponse already repairs; this second attempt only helps when
    // the repair itself needs a second pass (nested trailing commas, etc.).
    return JSON.parse(repairJsonArtefacts(cleaned));
  }
}

/**
 * Logs AI generation attempts to MongoDB when userId is provided.
 */
async function logAIGeneration(params: {
  userId?: string;
  input: unknown;
  model: string;
  status: "success" | "failed" | "timeout";
  latencyMs: number;
  errorCategory?: "provider_error" | "invalid_output" | "timeout" | "rate_limit" | "unknown";
}) {
  if (!params.userId) return;
  try {
    await AIGenerationLogModel.create({
      user: params.userId,
      input: params.input,
      provider: "groq",
      model: params.model,
      status: params.status,
      latencyMs: params.latencyMs,
      errorCategory: params.errorCategory ?? null,
    });
  } catch (err) {
    console.error("[aiService] Failed to write AIGenerationLog:", err);
  }
}

/**
 * Generates an AI recipe via Groq API with constrained prompt, Zod validation, and pantry matching.
 * (FR-AI-01..08, FR-PANTRY-01..03, NFR-PERF-03)
 */
export async function generateAIRecipe(
  input: AIRecipePromptInput,
  userId?: string,
): Promise<{ recipe: AIRecipeOutput; pantryMatch: PantryMatchResult }> {
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey || apiKey === "change-me") {
    throw new ApiError(502, "AI_PROVIDER_ERROR", "AI service key is not configured.");
  }

  const { systemPrompt, userPrompt } = buildRecipePrompt(input);
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS);

  let rawResponseText = "";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      console.error(`[aiService] Groq API returned ${res.status}: ${errorBody}`);
      await logAIGeneration({
        userId,
        input,
        model: env.GROQ_MODEL,
        status: "failed",
        latencyMs,
        errorCategory: res.status === 429 ? "rate_limit" : "provider_error",
      });
      throw new ApiError(
        502,
        "AI_PROVIDER_ERROR",
        "AI service is currently unavailable. Please try again.",
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    rawResponseText = data.choices?.[0]?.message?.content ?? "";
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (err instanceof ApiError) throw err;

    const isTimeout =
      (err as Error)?.name === "AbortError" ||
      (err as Error)?.message?.includes("aborted");

    await logAIGeneration({
      userId,
      input,
      model: env.GROQ_MODEL,
      status: isTimeout ? "timeout" : "failed",
      latencyMs,
      errorCategory: isTimeout ? "timeout" : "provider_error",
    });

    if (isTimeout) {
      throw new ApiError(
        504,
        "AI_PROVIDER_ERROR",
        "AI recipe generation request timed out. Please try again.",
      );
    }

    throw new ApiError(
      502,
      "AI_PROVIDER_ERROR",
      "AI service encountered an error. Please try again.",
    );
  }

  const latencyMs = Date.now() - startTime;
  const cleanedJson = cleanJsonResponse(rawResponseText);
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(cleanedJson);
  } catch {
    await logAIGeneration({
      userId,
      input,
      model: env.GROQ_MODEL,
      status: "failed",
      latencyMs,
      errorCategory: "invalid_output",
    });
    throw new ApiError(
      502,
      "AI_PROVIDER_ERROR",
      "AI generated invalid JSON structure. Please try again.",
    );
  }

  const validationResult = AIRecipeOutputSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    console.error(
      "[aiService] AIRecipeOutputSchema validation failed:",
      validationResult.error.flatten(),
    );
    await logAIGeneration({
      userId,
      input,
      model: env.GROQ_MODEL,
      status: "failed",
      latencyMs,
      errorCategory: "invalid_output",
    });
    throw new ApiError(
      502,
      "AI_PROVIDER_ERROR",
      "AI generated recipe failed validation rules. Please try again.",
    );
  }

  const recipe = validationResult.data;
  const pantryMatch = matchPantry(input.ingredients, recipe.ingredients);

  await logAIGeneration({
    userId,
    input,
    model: env.GROQ_MODEL,
    status: "success",
    latencyMs,
  });

  return { recipe, pantryMatch };
}

/**
 * Generates flavor pairing suggestions via Groq API.
 * (FR-FLAVOR-01..03)
 */
export async function generateFlavorPairings(
  input: FlavorPairingInput,
  userId?: string,
): Promise<{ suggestions: FlavorPairingSuggestion[] }> {
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey || apiKey === "change-me") {
    throw new ApiError(502, "AI_PROVIDER_ERROR", "AI service key is not configured.");
  }

  const { systemPrompt, userPrompt } = buildFlavorPairingPrompt(input);
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS);

  let rawResponseText = "";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      await logAIGeneration({
        userId,
        input,
        model: env.GROQ_MODEL,
        status: "failed",
        latencyMs,
        errorCategory: res.status === 429 ? "rate_limit" : "provider_error",
      });
      throw new ApiError(
        502,
        "AI_PROVIDER_ERROR",
        "AI flavor pairing service unavailable. Please try again.",
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    rawResponseText = data.choices?.[0]?.message?.content ?? "";
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    if (err instanceof ApiError) throw err;

    const isTimeout =
      (err as Error)?.name === "AbortError" ||
      (err as Error)?.message?.includes("aborted");

    await logAIGeneration({
      userId,
      input,
      model: env.GROQ_MODEL,
      status: isTimeout ? "timeout" : "failed",
      latencyMs,
      errorCategory: isTimeout ? "timeout" : "provider_error",
    });

    if (isTimeout) {
      throw new ApiError(
        504,
        "AI_PROVIDER_ERROR",
        "AI flavor pairing request timed out. Please try again.",
      );
    }

    throw new ApiError(
      502,
      "AI_PROVIDER_ERROR",
      "AI service encountered an error. Please try again.",
    );
  }

  const latencyMs = Date.now() - startTime;
  const cleanedJson = cleanJsonResponse(rawResponseText);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleanedJson);
  } catch {
    await logAIGeneration({
      userId,
      input,
      model: env.GROQ_MODEL,
      status: "failed",
      latencyMs,
      errorCategory: "invalid_output",
    });
    throw new ApiError(
      502,
      "AI_PROVIDER_ERROR",
      "AI returned invalid flavor pairing data format.",
    );
  }

  const validationResult = FlavorPairingOutputSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    await logAIGeneration({
      userId,
      input,
      model: env.GROQ_MODEL,
      status: "failed",
      latencyMs,
      errorCategory: "invalid_output",
    });
    throw new ApiError(
      502,
      "AI_PROVIDER_ERROR",
      "AI flavor pairing failed validation requirements.",
    );
  }

  await logAIGeneration({
    userId,
    input,
    model: env.GROQ_MODEL,
    status: "success",
    latencyMs,
  });

  return { suggestions: validationResult.data.suggestions };
}

/**
 * Constructs prompt for food photo visual analysis and nutrition estimation.
 * (FR-PHOTO-01..04, FR-NUTR-01..03)
 */
export function buildFoodPhotoAnalysisPrompt(
  mealContext?: string,
  notes?: string,
): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are FlavorAI Food Vision & Nutrition Analyst, a certified nutritional biochemist and master culinary analysis engine.
Your task is to analyze the provided food photo or meal image with high accuracy, detecting foods/ingredients, estimating portion sizes, and computing nutritional values.

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY a valid, raw, compact JSON object. No markdown fences, no <think> reasoning, no commentary before/after, no trailing commas. All numeric fields MUST be JSON numbers (never quoted strings).
2. Keep the output COMPACT to fit the token budget: summary under 150 chars, healthInsights max 2 short items, suggestedIngredientsForRecipe max 6 items, detectedFoods max 6 items.
3. The JSON object must strictly match this exact structure:
{
  "dishName": "Grilled Salmon with Asparagus and Quinoa",
  "summary": "Grilled salmon fillet served with tender asparagus spears and seasoned quinoa.",
  "detectedFoods": [
    {
      "name": "Grilled Salmon Fillet",
      "portion": "150g fillet",
      "confidence": "high",
      "calories": 280,
      "proteinGrams": 34,
      "carbsGrams": 0,
      "fatGrams": 15,
      "fiberGrams": 0
    }
  ],
  "totalNutrition": {
    "calories": { "min": 320, "max": 400, "estimate": 360 },
    "proteinGrams": { "min": 32, "max": 38, "estimate": 35 },
    "carbsGrams": { "min": 4, "max": 8, "estimate": 6 },
    "fatGrams": { "min": 18, "max": 24, "estimate": 21 },
    "fiberGrams": { "min": 0, "max": 2, "estimate": 1 }
  },
  "macroDistribution": {
    "proteinPercentage": 39,
    "carbsPercentage": 7,
    "fatPercentage": 54
  },
  "dietaryTags": ["high-protein", "gluten-free"],
  "allergenWarnings": ["Fish"],
  "healthInsights": ["High in bioavailable lean protein and heart-healthy Omega-3 fatty acids."],
  "suggestedIngredientsForRecipe": ["salmon fillet", "asparagus", "olive oil", "lemon"],
  "disclaimer": "Nutritional values are approximate AI estimations based on visual appearance and should not be used as clinical or medical advice."
}
4. macroDistribution percentages MUST sum to approximately 100%.
5. Allowed dietaryTags: "vegetarian", "vegan", "halal", "gluten-free", "dairy-free", "high-protein", "low-carb", "keto".
6. confidence MUST be exactly one of "high", "medium", "low" (lowercase).`;

  const details: string[] = [
    "Analyze this food photo. Estimate nutrition, detect ingredients, and calculate macros.",
  ];
  if (mealContext?.trim()) {
    details.push(`User Meal Context: ${mealContext.trim()}`);
  }
  if (notes?.trim()) {
    details.push(`User Notes: ${notes.trim()}`);
  }
  details.push("Output the analysis strictly as a valid JSON object matching the required schema.");

  const userPrompt = details.join("\n");
  return { systemPrompt, userPrompt };
}

/**
 * Analyzes food photo to estimate nutrition and breakdown ingredients.
 * (FR-PHOTO-01..04)
 */
export async function analyzeFoodPhoto(
  input: FoodPhotoAnalysisInput,
  userId?: string,
): Promise<FoodPhotoAnalysisResult> {
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey || apiKey === "change-me") {
    throw new ApiError(502, "AI_PROVIDER_ERROR", "AI service key is not configured.");
  }

  // Format image URL or validated data URL
  let formattedImageUrl = input.image;
  if (!input.image.startsWith("http://") && !input.image.startsWith("https://")) {
    if (!input.image.startsWith("data:")) {
      const mime = input.mimeType || "image/jpeg";
      // Validate file size and mime
      validateImageInput({
        base64Data: input.image,
        mimeType: mime,
        filename: input.filename,
      });
      formattedImageUrl = `data:${mime};base64,${input.image}`;
    } else {
      const mime = input.image.split(";")[0]?.replace("data:", "") || "image/jpeg";
      validateImageInput({
        base64Data: input.image,
        mimeType: mime,
        filename: input.filename,
      });
    }
  }

  const { systemPrompt, userPrompt } = buildFoodPhotoAnalysisPrompt(
    input.mealContext,
    input.notes,
  );

  const primaryModel = env.GROQ_MODEL_FOR_IMAGE || "qwen/qwen3.8-27b";
  // Live-verified 2026-09-21 against a free-tier key (GET /models + probes):
  // - `qwen/qwen3.8-27b` serves vision, but REJECTS response_format=json_object
  //   (400 "'messages' must contain the word 'json'..."), so it is always
  //   called without response_format. The strict-JSON system prompt + server
  //   Zod validation still apply downstream.
  // - `qwen/qwen3.6-27b` is NOT on that key (404 model_not_found). It stays out
  //   of the default path; keys with access can append it (or others) via
  //   GROQ_IMAGE_FALLBACK_MODELS.
  // Retired and never retried: llama-3.2-11b/90b-vision-preview,
  // meta-llama/llama-4-scout-17b-16e-instruct.
  const candidateModels = [primaryModel, ...env.GROQ_IMAGE_FALLBACK_MODELS].filter(
    (m, i, arr) => arr.indexOf(m) === i,
  );

  /** Models probed to reject response_format=json_object — call plain only. */
  const NO_JSON_FORMAT_MODELS = new Set(["qwen/qwen3.8-27b"]);

  interface VisionAttempt {
    model: string;
    status: number | "network" | "empty-content";
    note: string;
  }
  const attempts: VisionAttempt[] = [];
  let sawRateLimit = false;

  function sleepAbortable(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const abort = () =>
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      if (signal.aborted) {
        abort();
        return;
      }
      const id = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, ms);
      signal.addEventListener("abort", () => {
        clearTimeout(id);
        abort();
      });
    });
  }

  async function postChatCompletion(
    model: string,
    withJsonFormat: boolean,
    signal: AbortSignal,
  ): Promise<Response> {
    const bodyPayload: Record<string, unknown> = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: formattedImageUrl } },
          ],
        },
      ],
            temperature: 0, // deterministic output reduces token waste on reasoning
            // Free-tier OTPM cap is 1000 output tokens (Groq rejects larger
            // max_tokens outright: "reduce max_tokens"). A full nutrition JSON
            // is ~800 tokens, so use the whole budget — lower values truncate
            // the JSON mid-object and fail Zod parsing downstream.
            max_tokens: 1000,
    };

    if (withJsonFormat) {
      bodyPayload.response_format = { type: "json_object" };
    }

    const send = () =>
      fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal,
        body: JSON.stringify(bodyPayload),
      });

    let res = await send();
    // Free-tier image requests can burst past TPM limits: honor Retry-After
    // once per attempt instead of burning the fallback chain on a transient.
    if (res.status === 429) {
      sawRateLimit = true;
      const retryAfterSec = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfterSec)
        ? Math.min(Math.max(retryAfterSec * 1000, 1000), 10000)
        : 5000;
      attempts.push({
        model,
        status: 429,
        note: `rate-limited, retrying once after ${Math.round(waitMs / 1000)}s`,
      });
      await sleepAbortable(waitMs, signal);
      res = await send();
    }
    return res;
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS);

  let rawResponseText = "";
  let successfulModel = primaryModel;

  try {
    for (const model of candidateModels) {
      const variants = NO_JSON_FORMAT_MODELS.has(model) ? [false] : [true, false];
      for (const useJsonFormat of variants) {
        let res: Response;
        try {
          res = await postChatCompletion(model, useJsonFormat, controller.signal);
        } catch (fetchErr) {
          if ((fetchErr as Error)?.name === "AbortError") throw fetchErr;
          attempts.push({
            model,
            status: "network",
            note: (fetchErr as Error)?.message || "Network error",
          });
          continue;
        }

        if (res.ok) {
          const data = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          rawResponseText = data.choices?.[0]?.message?.content ?? "";
          // Metadata-only: never dump the full model payload into normal logs.
          console.debug(
            `[aiService] Vision response received (model: ${model}, chars: ${rawResponseText.length})`,
          );
          if (rawResponseText.trim()) {
            successfulModel = model;
            break;
          }
          attempts.push({
            model,
            status: "empty-content",
            note: useJsonFormat ? "json_format variant empty" : "plain variant empty",
          });
          continue;
        }

        const errBody = await res.text().catch(() => "");
        attempts.push({ model, status: res.status, note: errBody.slice(0, 300) });
        if (res.status === 401 || res.status === 403 || res.status === 404) {
          break; // access/config dead-end — the other variant can't help
        }
        // 400 (incl. json_validate_failed / response_format complaints) and 5xx:
        // fall through to the next variant.
      }

      if (rawResponseText.trim()) {
        break;
      }
    }

    clearTimeout(timeoutId);

    if (!rawResponseText.trim()) {
      console.error(
        `[aiService] Food photo analysis failed. Attempts: ${JSON.stringify(attempts)}`,
      );
      const latencyMs = Date.now() - startTime;
      const configDead = attempts.some(
        (a) => a.status === 401 || a.status === 403 || a.status === 404,
      );
      const rateLimitedOnly = sawRateLimit && !configDead;
      await logAIGeneration({
        userId,
        input: { mealContext: input.mealContext, filename: input.filename },
        model: primaryModel,
        status: "failed",
        latencyMs,
        errorCategory: rateLimitedOnly ? "rate_limit" : "provider_error",
      });
      if (rateLimitedOnly) {
        throw new ApiError(
          429,
          "RATE_LIMITED",
          "AI image analysis is busy right now. Please wait a moment and try again.",
        );
      }
      throw new ApiError(
        502,
        "AI_PROVIDER_ERROR",
        "Food photo nutrition analysis service unavailable. Please try again.",
      );
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (err instanceof ApiError) throw err;

    const isTimeout =
      (err as Error)?.name === "AbortError" ||
      (err as Error)?.message?.includes("aborted");

    await logAIGeneration({
      userId,
      input: { mealContext: input.mealContext, filename: input.filename },
      model: primaryModel,
      status: isTimeout ? "timeout" : "failed",
      latencyMs,
      errorCategory: isTimeout ? "timeout" : "provider_error",
    });

    if (isTimeout) {
      throw new ApiError(
        504,
        "AI_PROVIDER_ERROR",
        "Food photo analysis request timed out. Please try again.",
      );
    }

    throw new ApiError(
      502,
      "AI_PROVIDER_ERROR",
      "AI service encountered an error while analyzing the image. Please try again.",
    );
  }

  const latencyMs = Date.now() - startTime;
  const cleanedJson = cleanJsonResponse(rawResponseText);
  let parsedJson: unknown;

  try {
    parsedJson = tryParseModelJson(cleanedJson);
  } catch {
    // Distinguish truncation (balanced extraction failed → JSON cut off by
    // max_tokens) from genuinely malformed output so the message is actionable.
    const looksTruncated =
      extractBalancedJsonObject(cleanedJson) === null && cleanedJson.includes("{");
    console.error(
      `[aiService] Food photo JSON.parse failed (model: ${successfulModel}, ` +
        `rawChars: ${rawResponseText.length}, cleanedChars: ${cleanedJson.length}, ` +
        `truncated: ${looksTruncated}). Raw preview: ${rawResponseText.slice(0, 500)} ` +
        `| Cleaned preview: ${cleanedJson.slice(0, 500)}`,
    );
    await logAIGeneration({
      userId,
      input: { mealContext: input.mealContext, filename: input.filename },
      model: successfulModel,
      status: "failed",
      latencyMs,
      errorCategory: "invalid_output",
    });
    throw new ApiError(
      502,
      "AI_PROVIDER_ERROR",
      looksTruncated
        ? "AI response was cut off before completing. Please try again with a clearer photo."
        : "AI returned invalid nutrition analysis data format.",
    );
  }

  // Pre-normalize common model quirks before Zod validation.
  // Vision models frequently return numbers as strings ("280"), confidence in
  // mixed case ("High"), or single objects where arrays are expected.
  if (typeof parsedJson === "object" && parsedJson !== null) {
    const rawObj = parsedJson as Record<string, unknown>;
    const toNonNegativeNumber = (v: unknown): number | null => {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
      if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v.replace(/,/g, "").trim());
        if (Number.isFinite(n) && n >= 0) return n;
      }
      return null;
    };

    // 1. Default disclaimer if missing or empty
    if (!rawObj.disclaimer || typeof rawObj.disclaimer !== "string" || !rawObj.disclaimer.trim()) {
      rawObj.disclaimer =
        "Nutritional values are approximate AI estimations based on visual appearance and should not be used as clinical or medical advice.";
    }

    // 2. Default summary if missing
    if (typeof rawObj.summary !== "string" || !rawObj.summary.trim()) {
      rawObj.summary = "";
    }

    // 3. Normalize detectedFoods: coerce numeric strings, fix confidence casing
    if (Array.isArray(rawObj.detectedFoods)) {
      for (const item of rawObj.detectedFoods) {
        if (typeof item !== "object" || item === null) continue;
        const food = item as Record<string, unknown>;
        for (const key of [
          "calories",
          "proteinGrams",
          "carbsGrams",
          "fatGrams",
          "fiberGrams",
        ]) {
          if (key in food && typeof food[key] !== "number") {
            const coerced = toNonNegativeNumber(food[key]);
            if (coerced !== null) food[key] = coerced;
            else if (key !== "fiberGrams") food[key] = 0;
            else delete food[key];
          }
        }
        if (typeof food.confidence === "string") {
          const c = food.confidence.toLowerCase().trim();
          food.confidence =
            c === "high" || c === "medium" || c === "low" ? c : "medium";
        } else if (food.confidence == null) {
          food.confidence = "medium";
        }
        if (typeof food.portion !== "string" || !food.portion.trim()) {
          food.portion = "1 serving";
        }
      }
    }

    // 4. Normalize totalNutrition ranges: coerce numeric strings
    if (typeof rawObj.totalNutrition === "object" && rawObj.totalNutrition !== null) {
      const tn = rawObj.totalNutrition as Record<string, unknown>;
      for (const key of ["calories", "proteinGrams", "carbsGrams", "fatGrams", "fiberGrams"]) {
        const range = tn[key] as Record<string, unknown> | undefined;
        if (typeof range === "object" && range !== null) {
          for (const bound of ["min", "max", "estimate"]) {
            if (bound in range && typeof range[bound] !== "number") {
              const coerced = toNonNegativeNumber(range[bound]);
              if (coerced !== null) range[bound] = coerced;
            }
          }
        }
      }
    }

    // 5. Compute macroDistribution from totalNutrition when missing or incomplete,
    //    coercing any numeric strings first.
    const macro = rawObj.macroDistribution as Record<string, unknown> | undefined;
    const hasMacro =
      macro !== null &&
      typeof macro === "object" &&
      typeof macro.proteinPercentage === "number";

    if (!hasMacro && typeof rawObj.totalNutrition === "object" && rawObj.totalNutrition !== null) {
      const tn = rawObj.totalNutrition as Record<string, Record<string, unknown>>;
      const num = (v: unknown): number => {
        const n = toNonNegativeNumber(v);
        return n ?? 0;
      };
      const protein = num(tn.proteinGrams?.estimate) * 4;
      const carbs = num(tn.carbsGrams?.estimate) * 4;
      const fat = num(tn.fatGrams?.estimate) * 9;
      const total = protein + carbs + fat || 1;
      rawObj.macroDistribution = {
        proteinPercentage: Math.round((protein / total) * 100),
        carbsPercentage: Math.round((carbs / total) * 100),
        fatPercentage: Math.round((fat / total) * 100),
      };
    } else if (hasMacro && macro) {
      for (const k of ["proteinPercentage", "carbsPercentage", "fatPercentage"]) {
        if (typeof macro[k] !== "number") {
          const coerced = toNonNegativeNumber(macro[k]);
          if (coerced !== null) macro[k] = Math.min(100, Math.max(0, coerced));
        }
      }
    }

    // 6. Normalize dietaryTags — strip any values outside the allowed enum
    const validLabels = new Set([
      "vegetarian",
      "vegan",
      "halal",
      "gluten-free",
      "dairy-free",
      "high-protein",
      "low-carb",
      "keto",
    ]);
    if (Array.isArray(rawObj.dietaryTags)) {
      rawObj.dietaryTags = rawObj.dietaryTags
        .map((t) => String(t).toLowerCase().trim())
        .filter((t) => validLabels.has(t));
    } else {
      rawObj.dietaryTags = [];
    }

    // 7. Default empty arrays for other optional array fields
    if (!Array.isArray(rawObj.allergenWarnings)) rawObj.allergenWarnings = [];
    if (!Array.isArray(rawObj.healthInsights)) rawObj.healthInsights = [];
    if (!Array.isArray(rawObj.suggestedIngredientsForRecipe))
      rawObj.suggestedIngredientsForRecipe = [];
  }

  const validationResult = FoodPhotoAnalysisResult.safeParse(parsedJson);
  if (!validationResult.success) {
    console.error(
      "[aiService] FoodPhotoAnalysisResult validation failed:",
      validationResult.error.flatten(),
    );
    console.error("[aiService] Raw parsed JSON (post-normalization):", JSON.stringify(parsedJson));
    await logAIGeneration({
      userId,
      input: { mealContext: input.mealContext, filename: input.filename },
      model: successfulModel,
      status: "failed",
      latencyMs,
      errorCategory: "invalid_output",
    });
    throw new ApiError(
      502,
      "AI_PROVIDER_ERROR",
      "AI food analysis output did not pass validation requirements.",
    );
  }

  await logAIGeneration({
    userId,
    input: { mealContext: input.mealContext, filename: input.filename },
    model: successfulModel,
    status: "success",
    latencyMs,
  });

  return validationResult.data;
}


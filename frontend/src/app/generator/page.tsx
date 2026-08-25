"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRotateLeft,
  Check,
  Clock,
  Flame,
  MagicWand,
  Sparkles,
} from "@gravity-ui/icons";
import {
  ApiError,
  createRecipe,
  generateAIRecipe,
  getMyProfile,
  publishRecipe,
  suggestFlavorPairings,
} from "@/lib/api";
import type {
  AIRecipeOutput,
  AIRecipePromptInput,
  DietaryLabel,
  Difficulty,
  FlavorPairingSuggestion,
  MealType,
  RecipeCategory,
  RecipeIngredient,
} from "@/lib/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  DisclaimerBanner,
  Input,
  Select,
  TagInput,
} from "@/components/ui";
import { NutritionBadge } from "@/components/recipes/nutrition-badge";

const DIETARY_OPTIONS: ReadonlyArray<{ value: DietaryLabel; label: string }> = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "halal", label: "Halal" },
  { value: "gluten-free", label: "Gluten-Free" },
  { value: "dairy-free", label: "Dairy-Free" },
  { value: "high-protein", label: "High-Protein" },
  { value: "low-carb", label: "Low-Carb" },
  { value: "keto", label: "Keto" },
];

const MEAL_TYPES: ReadonlyArray<{ value: MealType | ""; label: string }> = [
  { value: "", label: "Any Meal Type" },
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
  { value: "dessert", label: "Dessert" },
];

const DIFFICULTY_OPTIONS: ReadonlyArray<{ value: Difficulty | ""; label: string }> = [
  { value: "", label: "Any Difficulty" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const GENERATION_PROGRESS_MESSAGES = [
  "Analyzing pantry ingredients...",
  "Applying dietary & allergy constraints...",
  "Crafting step-by-step cooking instructions...",
  "Calculating nutrition estimates...",
];

export default function GeneratorPage() {
  // Form State
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [dietaryLabels, setDietaryLabels] = useState<DietaryLabel[]>([]);
  const [mealType, setMealType] = useState<MealType | "">("");
  const [maxTime, setMaxTime] = useState<string>("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [servings, setServings] = useState<string>("2");
  const [excludedIngredients, setExcludedIngredients] = useState<string[]>([]);
  const [availableEquipment, setAvailableEquipment] = useState<string[]>([]);

  // Generation & Results State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<AIRecipeOutput | null>(null);

  // Profile Auto-fill state
  const [hasProfile, setHasProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Flavor pairings state
  const [selectedIngredientForPairing, setSelectedIngredientForPairing] = useState<string>("");
  const [pairingsLoading, setPairingsLoading] = useState(false);
  const [pairings, setPairings] = useState<FlavorPairingSuggestion[] | null>(null);

  // Save/Publish state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [createdRecipeId, setCreatedRecipeId] = useState<string | null>(null);

  // Fetch profile on mount to pre-fill dietary preferences
  useEffect(() => {
    getMyProfile()
      .then((user) => {
        setHasProfile(true);
        if (user.preferences) {
          if (user.preferences.dietaryLabels?.length) {
            setDietaryLabels(user.preferences.dietaryLabels);
          }
          if (user.preferences.dislikedIngredients?.length) {
            setExcludedIngredients(user.preferences.dislikedIngredients);
          }
          if (user.preferences.cookingTimeMaxMinutes) {
            setMaxTime(String(user.preferences.cookingTimeMaxMinutes));
          }
          if (user.preferences.difficulty) {
            setDifficulty(user.preferences.difficulty);
          }
        }
        setProfileLoaded(true);
      })
      .catch(() => {
        setHasProfile(false);
        setProfileLoaded(true);
      });
  }, []);

  // Handle progress timer during generation
  useEffect(() => {
    if (!isGenerating) return;

    const interval = setInterval(() => {
      setProgressStep((prev) => (prev < GENERATION_PROGRESS_MESSAGES.length - 1 ? prev + 1 : prev));
    }, 4000);

    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleDietaryToggle = (label: DietaryLabel) => {
    setDietaryLabels((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label],
    );
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!ingredients.length) {
      setValidationError("Please add at least one ingredient from your pantry.");
      return;
    }

    setValidationError(null);
    setError(null);
    setSaveSuccessMessage(null);
    setProgressStep(0);
    setIsGenerating(true);
    setRecipe(null);
    setPairings(null);

    const promptInput: AIRecipePromptInput = {
      ingredients,
      mealType: mealType || undefined,
      maxCookingTimeMinutes: maxTime ? parseInt(maxTime, 10) : undefined,
      difficulty: difficulty || undefined,
      servings: servings ? parseInt(servings, 10) : undefined,
      excludedIngredients: excludedIngredients.length ? excludedIngredients : undefined,
      availableEquipment: availableEquipment.length ? availableEquipment : undefined,
      preferences: dietaryLabels.length
        ? { dietaryLabels, allergies: [], dislikedIngredients: [] }
        : undefined,
    };

    try {
      const generated = await generateAIRecipe(promptInput);
      setRecipe(generated);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to generate recipe. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFetchPairings = async (ingredientName: string) => {
    if (!ingredientName) return;
    setSelectedIngredientForPairing(ingredientName);
    setPairingsLoading(true);
    try {
      const result = await suggestFlavorPairings({ ingredient: ingredientName });
      setPairings(result.pairings);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load flavor pairings.");
      }
    } finally {
      setPairingsLoading(false);
    }
  };

  const handleSaveRecipe = async (publishImmediately: boolean) => {
    if (!recipe) return;
    setIsSaving(true);
    setError(null);
    setSaveSuccessMessage(null);

    try {
      // Create recipe slug from title
      const baseSlug = recipe.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const slug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

      const created = await createRecipe({
        title: recipe.title,
        slug,
        summary: recipe.summary,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        cuisine: recipe.cuisine,
        category: recipe.category as RecipeCategory,
        tags: recipe.tags,
        dietaryLabels: recipe.dietaryLabels,
        allergenWarnings: recipe.allergenWarnings,
        nutrition: recipe.nutrition,
      });

      let finalRecipe = created;

      if (publishImmediately) {
        finalRecipe = await publishRecipe(created.id);
        setSaveSuccessMessage(`Recipe published successfully!`);
      } else {
        setSaveSuccessMessage(`Saved as draft successfully!`);
      }

      setCreatedRecipeId(finalRecipe.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to save recipe. Please sign in and try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI Pantry-to-Plate Engine</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Generate Smart Recipes
        </h1>
        <p className="mt-2 text-base text-neutral-600">
          Turn your available ingredients into custom, dietary-compliant recipes generated instantly by AI.
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Form Column */}
        <div className="lg:col-span-5">
          <Card className="p-6">
            <form onSubmit={handleGenerate} className="space-y-6">
              {/* Pantry Ingredients Input */}
              <div>
                <label className="block text-sm font-semibold text-neutral-900">
                  Pantry Ingredients <span className="text-orange-600">*</span>
                </label>
                <p className="mt-1 text-xs text-neutral-500">
                  Type an ingredient (e.g. &quot;Chicken&quot;, &quot;Garlic&quot;) and press Enter or comma.
                </p>
                <div className="mt-2">
                  <TagInput
                    value={ingredients}
                    onChange={setIngredients}
                    placeholder="Add ingredient..."
                  />
                </div>
                {validationError && (
                  <p className="mt-1 text-xs font-medium text-red-600" role="alert">
                    {validationError}
                  </p>
                )}
              </div>

              {/* Dietary Preferences Checkboxes */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-neutral-900">
                    Dietary Restrictions
                  </label>
                  {hasProfile && profileLoaded && (
                    <span className="text-xs font-medium text-emerald-700">
                      ✓ Profile defaults loaded
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {DIETARY_OPTIONS.map((opt) => (
                    <Checkbox
                      key={opt.value}
                      id={`diet-${opt.value}`}
                      label={opt.label}
                      checked={dietaryLabels.includes(opt.value)}
                      onChange={() => handleDietaryToggle(opt.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Meal & Time Constraints */}
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Meal Type"
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType | "")}
                >
                  {MEAL_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}
                >
                  {DIFFICULTY_OPTIONS.map((diff) => (
                    <option key={diff.value} value={diff.value}>
                      {diff.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Max Time (mins)"
                  type="number"
                  min={1}
                  max={360}
                  placeholder="e.g. 30"
                  value={maxTime}
                  onChange={(e) => setMaxTime(e.target.value)}
                />
                <Input
                  label="Servings"
                  type="number"
                  min={1}
                  max={12}
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                />
              </div>

              {/* Advanced Controls */}
              <div className="space-y-4 border-t border-neutral-100 pt-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700">
                    Excluded / Disliked Ingredients
                  </label>
                  <div className="mt-1">
                    <TagInput
                      value={excludedIngredients}
                      onChange={setExcludedIngredients}
                      placeholder="Add excluded item..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700">
                    Available Equipment
                  </label>
                  <div className="mt-1">
                    <TagInput
                      value={availableEquipment}
                      onChange={setAvailableEquipment}
                      placeholder="e.g. Air Fryer, Blender"
                    />
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full justify-center"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>Generating Recipe...</>
                ) : (
                  <>
                    <MagicWand className="h-5 w-5" />
                    <span>Generate Recipe</span>
                  </>
                )}
              </Button>
            </form>
          </Card>
        </div>

        {/* Output Column */}
        <div className="space-y-6 lg:col-span-7">
          {error && (
            <Alert variant="danger" title="Generation Error">
              {error}
            </Alert>
          )}

          {saveSuccessMessage && (
            <Alert variant="success" title="Success">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <span>{saveSuccessMessage}</span>
                {createdRecipeId && (
                  <Link
                    href={`/recipes/${createdRecipeId}`}
                    className="inline-flex items-center text-xs font-semibold underline hover:text-emerald-900"
                  >
                    View Created Recipe &rarr;
                  </Link>
                )}
              </div>
            </Alert>
          )}

          {/* Loading Indicator */}
          {isGenerating && (
            <Card className="border-orange-200 bg-orange-50/50 p-8 text-center">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="h-16 w-16 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
                  <Flame className="absolute inset-0 m-auto h-7 w-7 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">
                    {GENERATION_PROGRESS_MESSAGES[progressStep]}
                  </h3>
                  <p className="mt-1 text-xs text-neutral-600">
                    Groq AI is building your custom recipe. This typically takes 5–15 seconds.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Blank State */}
          {!isGenerating && !recipe && (
            <Card className="border-dashed p-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-neutral-900">
                Your Recipe Will Appear Here
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
                Add your pantry ingredients on the left and click &quot;Generate Recipe&quot; to create a step-by-step recipe tailored to your exact tastes.
              </p>
            </Card>
          )}

          {/* Generated Recipe Result */}
          {!isGenerating && recipe && (
            <div className="space-y-6">
              {/* Disclaimer Banners */}
              <DisclaimerBanner kind="ai" />
              {recipe.allergenWarnings.length > 0 && (
                <DisclaimerBanner kind="allergy" />
              )}

              {/* Recipe Details Card */}
              <Card className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900">
                      {recipe.title}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-600">
                      {recipe.summary}
                    </p>
                  </div>
                </div>

                {/* Metadata Pills */}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-medium text-neutral-700">
                  <div className="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-1.5">
                    <Clock className="h-4 w-4 text-neutral-500" />
                    <span>
                      Prep: {recipe.prepTimeMinutes}m | Cook: {recipe.cookTimeMinutes}m
                    </span>
                  </div>
                  <div className="rounded-lg bg-neutral-100 px-3 py-1.5">
                    Servings: {recipe.servings}
                  </div>
                  <div className="rounded-lg bg-neutral-100 px-3 py-1.5 capitalize">
                    Difficulty: {recipe.difficulty}
                  </div>
                  {recipe.cuisine && (
                    <div className="rounded-lg bg-neutral-100 px-3 py-1.5">
                      Cuisine: {recipe.cuisine}
                    </div>
                  )}
                </div>

                {/* Dietary Badges */}
                {recipe.dietaryLabels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {recipe.dietaryLabels.map((diet) => (
                      <Badge key={diet} variant="success">
                        {diet}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Ingredients List */}
                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-neutral-900">
                      Ingredients & Pantry Match
                    </h3>
                  </div>
                  <ul className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-neutral-50/50">
                    {recipe.ingredients.map((ing: RecipeIngredient, idx: number) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between p-3 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-neutral-900">
                            {ing.quantity && `${ing.quantity} `}
                            {ing.unit && `${ing.unit} `}
                            {ing.name}
                          </span>
                          {ing.notes && (
                            <span className="text-xs text-neutral-500">
                              ({ing.notes})
                            </span>
                          )}
                        </div>

                        {ing.pantryMatch === "used" && (
                          <Badge variant="success" className="text-[10px]">
                            Used from Pantry
                          </Badge>
                        )}
                        {ing.pantryMatch === "missing" && (
                          <Badge variant="warning" className="text-[10px]">
                            Needs Shopping
                          </Badge>
                        )}
                        {ing.pantryMatch === "substitution" && (
                          <Badge variant="secondary" className="text-[10px]">
                            Substitution
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Cooking Instructions */}
                <div className="mt-6">
                  <h3 className="text-base font-semibold text-neutral-900">
                    Step-by-Step Instructions
                  </h3>
                  <ol className="mt-3 space-y-3">
                    {recipe.steps.map((step) => (
                      <li
                        key={step.stepNumber}
                        className="shadow-2xs flex gap-3 rounded-xl border border-neutral-100 bg-white p-3.5 text-sm text-neutral-800"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-900">
                          {step.stepNumber}
                        </span>
                        <span className="mt-0.5 leading-relaxed">
                          {step.instruction}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Nutrition Badge */}
                <div className="mt-6">
                  <NutritionBadge nutrition={recipe.nutrition} variant="detailed" />
                </div>

                {/* Flavor Pairings Interactive Section */}
                <div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-950">
                    <Sparkles className="h-4 w-4 text-emerald-700" />
                    <span>Get AI Flavor Pairing Suggestions</span>
                  </h4>
                  <p className="mt-1 text-xs text-emerald-800">
                    Select an ingredient to discover complementary spices and additions.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {recipe.ingredients.map((ing, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleFetchPairings(ing.name)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                          selectedIngredientForPairing === ing.name
                            ? "bg-emerald-700 text-white"
                            : "border border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-100"
                        }`}
                      >
                        + Pair with {ing.name}
                      </button>
                    ))}
                  </div>

                  {pairingsLoading && (
                    <div className="mt-3 animate-pulse text-xs font-medium text-emerald-800">
                      Finding flavor pairings...
                    </div>
                  )}

                  {pairings && pairings.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <h5 className="text-xs font-bold text-emerald-950">
                        Suggested Pairings for &quot;{selectedIngredientForPairing}&quot;:
                      </h5>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {pairings.map((p, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-emerald-200 bg-white p-2.5 text-xs"
                          >
                            <div className="font-semibold capitalize text-emerald-900">
                              {p.ingredient} ({p.type})
                            </div>
                            <div className="mt-0.5 text-neutral-600">
                              {p.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Recipe Actions */}
                <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleGenerate()}
                    disabled={isSaving || isGenerating}
                  >
                    <ArrowRotateLeft className="h-4 w-4" />
                    <span>Regenerate</span>
                  </Button>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleSaveRecipe(false)}
                      disabled={isSaving}
                    >
                      {isSaving ? "Saving..." : "Save as Draft"}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => handleSaveRecipe(true)}
                      disabled={isSaving}
                    >
                      <Check className="h-4 w-4" />
                      <span>{isSaving ? "Publishing..." : "Publish Recipe"}</span>
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

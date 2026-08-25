"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Check,
  Clock,
  Pencil,
  Sparkles,
  Star,
  TrashBin,
} from "@gravity-ui/icons";
import {
  ApiError,
  deleteRecipe,
  getRecipe,
  publishRecipe,
  suggestFlavorPairings,
  unpublishRecipe,
} from "@/lib/api";
import type { FlavorPairingSuggestion, Recipe } from "@/lib/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  DisclaimerBanner,
  ErrorState,
  LoadingState,
} from "@/components/ui";
import { NutritionBadge } from "@/components/recipes/nutrition-badge";

interface RecipeDetailPageProps {
  params: { id: string };
}

export default function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const { id } = params;
  const router = useRouter();

  // Recipe load state
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interactive Servings Scaler state
  const [servingsScale, setServingsScale] = useState<number>(1);

  // Interactive Checklist states
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  // Flavor Pairings state
  const [selectedIngredientForPairing, setSelectedIngredientForPairing] = useState<string>("");
  const [pairingsLoading, setPairingsLoading] = useState(false);
  const [pairings, setPairings] = useState<FlavorPairingSuggestion[] | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);

  // Owner action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch recipe on mount
  useEffect(() => {
    getRecipe(id)
      .then((data) => {
        setRecipe(data);
        setServingsScale(data.servings || 1);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load recipe details. Please try again.");
        }
        setIsLoading(false);
      });
  }, [id]);

  const handleToggleIngredient = (idx: number) => {
    setCheckedIngredients((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleToggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => ({ ...prev, [stepNumber]: !prev[stepNumber] }));
  };

  const handleFetchPairings = async (ingredientName: string) => {
    if (!ingredientName) return;
    setSelectedIngredientForPairing(ingredientName);
    setPairingsLoading(true);
    setPairingError(null);
    try {
      const result = await suggestFlavorPairings({ ingredient: ingredientName });
      setPairings(result.pairings);
    } catch (err) {
      if (err instanceof ApiError) {
        setPairingError(err.message);
      } else {
        setPairingError("Failed to fetch flavor pairings.");
      }
    } finally {
      setPairingsLoading(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!recipe) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const updated =
        recipe.status === "published"
          ? await unpublishRecipe(recipe.id)
          : await publishRecipe(recipe.id);
      setRecipe(updated);
      setActionSuccess(
        updated.status === "published"
          ? "Recipe is now published!"
          : "Recipe has been unpublished and moved to drafts.",
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError("Action failed. Please try again.");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!recipe) return;
    setActionLoading(true);
    setActionError(null);

    try {
      await deleteRecipe(recipe.id);
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError("Failed to delete recipe.");
      }
      setShowDeleteModal(false);
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16">
        <LoadingState label="Loading recipe details..." />
      </main>
    );
  }

  if (error || !recipe) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16">
        <ErrorState
          description={error ?? "The requested recipe could not be found."}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => router.refresh()}
            >
              Try Again
            </Button>
          }
        />
      </main>
    );
  }

  const isPublished = recipe.status === "published";
  const defaultServings = recipe.servings || 1;
  const scalingRatio = servingsScale / defaultServings;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb Navigation */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-neutral-500">
        <Link href="/" className="hover:text-neutral-900 transition">
          Home
        </Link>
        <span>/</span>
        <Link href="/generator" className="hover:text-neutral-900 transition">
          Generator
        </Link>
        <span>/</span>
        <span className="font-medium text-neutral-900 truncate max-w-[200px]">
          {recipe.title}
        </span>
      </nav>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <Card className="max-w-md p-6 space-y-4 shadow-xl bg-white">
            <h3
              id="delete-dialog-title"
              className="text-lg font-bold text-neutral-900"
            >
              Delete Recipe?
            </h3>
            <p className="text-sm text-neutral-600">
              Are you sure you want to delete &quot;{recipe.title}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDeleteRecipe}
                disabled={actionLoading}
              >
                {actionLoading ? "Deleting..." : "Delete Permanently"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Status Alerts */}
      {actionError && (
        <div className="mb-6">
          <Alert variant="danger" title="Action Error">
            {actionError}
          </Alert>
        </div>
      )}
      {actionSuccess && (
        <div className="mb-6">
          <Alert variant="success" title="Updated">
            {actionSuccess}
          </Alert>
        </div>
      )}

      {/* Hero Card */}
      <Card className="overflow-hidden p-0">
        {/* Cover Image if available */}
        {recipe.imageUrl ? (
          <div className="relative aspect-21/9 w-full overflow-hidden bg-neutral-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-36 w-full items-center justify-center bg-linear-to-r from-orange-100 via-amber-50 to-orange-100">
            <Sparkles className="h-10 w-10 text-orange-400 opacity-60" />
          </div>
        )}

        <div className="p-6 sm:p-8">
          {/* Status & Source Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={recipe.source === "ai" ? "primary" : "secondary"}>
                {recipe.source === "ai" ? "✨ AI Generated" : "Chef Created"}
              </Badge>
              <Badge variant={isPublished ? "success" : "warning"}>
                {recipe.status.toUpperCase()}
              </Badge>
              {recipe.category && (
                <Badge variant="outline" className="capitalize">
                  {recipe.category}
                </Badge>
              )}
            </div>

            {/* Ratings & Favorites summary */}
            <div className="flex items-center gap-4 text-xs font-semibold text-neutral-700">
              <div className="flex items-center gap-1 text-amber-600">
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                <span>
                  {recipe.averageRating > 0
                    ? recipe.averageRating.toFixed(1)
                    : "New"}
                </span>
                {recipe.ratingCount > 0 && (
                  <span className="text-neutral-400 font-normal">
                    ({recipe.ratingCount})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-rose-600">
                <Bookmark className="h-4 w-4 text-rose-500" />
                <span>{recipe.favoriteCount}</span>
              </div>
            </div>
          </div>

          {/* Title & Summary */}
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
            {recipe.title}
          </h1>
          {recipe.summary && (
            <p className="mt-2 text-base text-neutral-600 leading-relaxed">
              {recipe.summary}
            </p>
          )}

          {/* Metadata Bar */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl bg-neutral-50 p-4 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600 shrink-0" />
              <div>
                <div className="font-semibold text-neutral-900">Total Time</div>
                <div className="text-neutral-600">
                  {recipe.totalTimeMinutes} mins ({recipe.prepTimeMinutes}m prep / {recipe.cookTimeMinutes}m cook)
                </div>
              </div>
            </div>

            <div>
              <div className="font-semibold text-neutral-900">Servings</div>
              <div className="text-neutral-600">{recipe.servings} default</div>
            </div>

            <div>
              <div className="font-semibold text-neutral-900">Difficulty</div>
              <div className="text-neutral-600 capitalize">{recipe.difficulty}</div>
            </div>

            {recipe.cuisine && (
              <div>
                <div className="font-semibold text-neutral-900">Cuisine</div>
                <div className="text-neutral-600">{recipe.cuisine}</div>
              </div>
            )}
          </div>

          {/* Dietary Labels */}
          {recipe.dietaryLabels.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-neutral-500 mr-1">
                Dietary:
              </span>
              {recipe.dietaryLabels.map((diet) => (
                <Badge key={diet} variant="success">
                  {diet}
                </Badge>
              ))}
            </div>
          )}

          {/* Owner Action Toolbar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-6">
            <div className="text-xs text-neutral-500">
              Created {new Date(recipe.createdAt).toLocaleDateString()}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/recipes/${recipe.id}/edit`}>
                <Button type="button" variant="outline" size="sm">
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit Recipe</span>
                </Button>
              </Link>

              <Button
                type="button"
                variant={isPublished ? "secondary" : "primary"}
                size="sm"
                onClick={handleTogglePublish}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Updating..."
                  : isPublished
                  ? "Unpublish"
                  : "Publish Recipe"}
              </Button>

              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                disabled={actionLoading}
              >
                <TrashBin className="h-3.5 w-3.5" />
                <span>Delete</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Disclaimers (§12.7) */}
      <div className="mt-6 space-y-4">
        {recipe.source === "ai" && <DisclaimerBanner kind="ai" />}
        {recipe.allergenWarnings.length > 0 && <DisclaimerBanner kind="allergy" />}
      </div>

      {/* Ingredients & Steps Layout */}
      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        {/* Ingredients Column */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h2 className="text-lg font-bold text-neutral-900">Ingredients</h2>

              {/* Interactive Servings Scaler */}
              <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs">
                <span className="font-semibold text-neutral-700">Servings:</span>
                <button
                  type="button"
                  onClick={() => setServingsScale((s) => Math.max(1, s - 1))}
                  className="h-5 w-5 rounded bg-white font-bold text-neutral-700 shadow-2xs hover:bg-neutral-200"
                  aria-label="Decrease servings"
                >
                  -
                </button>
                <span className="w-5 text-center font-bold text-orange-900">
                  {servingsScale}
                </span>
                <button
                  type="button"
                  onClick={() => setServingsScale((s) => Math.min(20, s + 1))}
                  className="h-5 w-5 rounded bg-white font-bold text-neutral-700 shadow-2xs hover:bg-neutral-200"
                  aria-label="Increase servings"
                >
                  +
                </button>
              </div>
            </div>

            {/* Ingredients Checklist */}
            <ul className="mt-4 space-y-3">
              {recipe.ingredients.map((ing, idx) => {
                const scaledQty = ing.quantity
                  ? Math.round(ing.quantity * scalingRatio * 100) / 100
                  : null;
                const isChecked = Boolean(checkedIngredients[idx]);

                return (
                  <li
                    key={idx}
                    className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-sm transition ${
                      isChecked
                        ? "border-neutral-200 bg-neutral-50 text-neutral-400 line-through"
                        : "border-neutral-200 bg-white text-neutral-900"
                    }`}
                  >
                    <Checkbox
                      id={`ing-${idx}`}
                      checked={isChecked}
                      onChange={() => handleToggleIngredient(idx)}
                      label={
                        <span className="font-medium">
                          {scaledQty && `${scaledQty} `}
                          {ing.unit && `${ing.unit} `}
                          {ing.name}
                          {ing.notes && (
                            <span className="text-xs font-normal text-neutral-500 block">
                              ({ing.notes})
                            </span>
                          )}
                        </span>
                      }
                    />

                    {ing.pantryMatch === "used" && (
                      <Badge variant="success" className="text-[10px] shrink-0">
                        Pantry
                      </Badge>
                    )}
                    {ing.pantryMatch === "missing" && (
                      <Badge variant="warning" className="text-[10px] shrink-0">
                        Missing
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Detailed Nutrition Badge */}
          <NutritionBadge nutrition={recipe.nutrition} variant="detailed" />
          <DisclaimerBanner kind="nutrition" />
        </div>

        {/* Cooking Steps Column */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-bold text-neutral-900 border-b border-neutral-100 pb-3">
              Step-by-Step Instructions
            </h2>

            <ol className="mt-4 space-y-4">
              {recipe.steps.map((step) => {
                const isDone = Boolean(completedSteps[step.stepNumber]);

                return (
                  <li
                    key={step.stepNumber}
                    onClick={() => handleToggleStep(step.stepNumber)}
                    className={`cursor-pointer rounded-xl border p-4 transition ${
                      isDone
                        ? "border-emerald-200 bg-emerald-50/50 text-neutral-500"
                        : "border-neutral-200 bg-white hover:border-orange-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                          isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-orange-100 text-orange-900"
                        }`}
                      >
                        {isDone ? <Check className="h-4 w-4" /> : step.stepNumber}
                      </div>

                      <div className="flex-1">
                        <div
                          className={`text-sm leading-relaxed ${
                            isDone ? "line-through text-neutral-500" : "text-neutral-900 font-medium"
                          }`}
                        >
                          {step.instruction}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          {/* AI Flavor Pairings Interactive Section */}
          <Card className="p-6 border-emerald-200 bg-emerald-50/30">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-bold text-emerald-950">
                Explore AI Flavor Pairings
              </h3>
            </div>
            <p className="mt-1 text-xs text-emerald-800">
              Select an ingredient from this recipe to discover complementary spices, garnishes, or pairings recommended by Groq AI.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {recipe.ingredients.map((ing, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleFetchPairings(ing.name)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    selectedIngredientForPairing === ing.name
                      ? "bg-emerald-800 text-white shadow-2xs"
                      : "bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-100"
                  }`}
                >
                  + Pair with {ing.name}
                </button>
              ))}
            </div>

            {pairingsLoading && (
              <div className="mt-4 text-xs font-medium text-emerald-800 animate-pulse">
                Asking AI for flavor pairing suggestions...
              </div>
            )}

            {pairingError && (
              <div className="mt-4 text-xs font-medium text-red-600">
                {pairingError}
              </div>
            )}

            {pairings && pairings.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-emerald-200 pt-3">
                <h4 className="text-xs font-bold text-emerald-950">
                  Recommended Pairings for &quot;{selectedIngredientForPairing}&quot;:
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {pairings.map((p, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-emerald-200 bg-white p-3 text-xs shadow-2xs"
                    >
                      <div className="font-semibold text-emerald-950 capitalize flex items-center justify-between">
                        <span>{p.ingredient}</span>
                        <Badge
                          variant={p.type === "addition" ? "success" : "secondary"}
                          className="text-[10px]"
                        >
                          {p.type}
                        </Badge>
                      </div>
                      <p className="mt-1 text-neutral-600 leading-normal">
                        {p.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}

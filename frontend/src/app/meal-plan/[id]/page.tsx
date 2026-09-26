"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Minus, Plus, TrashBin, Xmark } from "@gravity-ui/icons";
import { AuthGuard } from "@/components/auth";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  DisclaimerBanner,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
  TagInput,
  Textarea,
} from "@/components/ui";
import {
  ApiError,
  aiGenerateMealPlan,
  getMealPlan,
  optimizeMealPlan,
  swapMeal,
  updateMealPlan,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatEnumLabel } from "@/lib/format";
import type {
  AIGenerateMealPlanInput,
  DietaryLabel,
  MealPlan,
  MealPlanMeal,
  MealPlanMealInput,
  MealType,
  UpdateMealPlanInput,
} from "@/lib/types";

const MEAL_ORDER: readonly MealType[] = ["breakfast", "lunch", "dinner", "snack", "dessert"];

const DIET_LABELS: readonly DietaryLabel[] = [
  "vegetarian",
  "vegan",
  "halal",
  "gluten-free",
  "dairy-free",
  "high-protein",
  "low-carb",
  "keto",
];

function dayLabel(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function weekDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return dates;
  for (let ms = startMs; ms <= endMs && dates.length < 31; ms += 24 * 60 * 60 * 1000) {
    dates.push(new Date(ms).toISOString().slice(0, 10));
  }
  return dates;
}

function mealToInput(meal: MealPlanMeal): MealPlanMealInput {
  return {
    date: meal.date,
    mealType: meal.mealType,
    recipeId: meal.recipeId,
    servings: meal.servings,
    source: meal.source,
    notes: meal.notes,
  };
}

function MealPlanDetailContent() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const planId = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [busyMealId, setBusyMealId] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [moveDate, setMoveDate] = useState("");
  const [moveMealType, setMoveMealType] = useState<MealType>("dinner");

  const [genOpen, setGenOpen] = useState(false);
  const [genWeekStart, setGenWeekStart] = useState("");
  const [genDays, setGenDays] = useState("7");
  const [genMealsPerDay, setGenMealsPerDay] = useState<MealType[]>([
    "breakfast",
    "lunch",
    "dinner",
  ]);
  const [genServings, setGenServings] = useState("2");
  const [genCalorie, setGenCalorie] = useState("");
  const [genProtein, setGenProtein] = useState("");
  const [genDiet, setGenDiet] = useState<DietaryLabel[]>([]);
  const [genCuisine, setGenCuisine] = useState("");
  const [genMaxTime, setGenMaxTime] = useState("");
  const [genAvoid, setGenAvoid] = useState<string[]>([]);
  const [genBudget, setGenBudget] = useState("");
  const [genNotes, setGenNotes] = useState("");
  const [genPantry, setGenPantry] = useState(true);
  const [genError, setGenError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!token || !planId) {
        return Promise.resolve().then(() => {
          setIsLoading(false);
          if (!planId) setError("Missing plan id.");
        });
      }
      return Promise.resolve()
        .then(() => {
          setIsLoading(true);
          setError(null);
        })
        .then(() => getMealPlan(planId, { token, signal }))
        .then((data) => {
          setPlan(data);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(
            err instanceof ApiError ? err.message : "Failed to load the meal plan. Please try again.",
          );
          setIsLoading(false);
        });
    },
    [token, planId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const groupedDays = useMemo(() => {
    if (!plan) return [];
    const byDate = new Map<string, MealPlanMeal[]>();
    for (const meal of plan.meals) {
      const list = byDate.get(meal.date) ?? [];
      list.push(meal);
      byDate.set(meal.date, list);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, meals]) => ({
        date,
        meals: [...meals].sort(
          (a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType),
        ),
      }));
  }, [plan]);

  const dates = useMemo(
    () => (plan ? weekDates(plan.weekStartDate, plan.weekEndDate) : []),
    [plan],
  );

  /** PATCH helper: rebuild the full meals array with one meal transformed. */
  const patchMeals = (
    transform: (meal: MealPlanMeal) => MealPlanMealInput | null,
    done: () => void,
  ) => {
    if (!plan) return;
    const meals: MealPlanMealInput[] = [];
    for (const meal of plan.meals) {
      const next = transform(meal);
      if (next) meals.push(next);
    }
    const payload: UpdateMealPlanInput = { meals };
    updateMealPlan(plan.id, payload, { token })
      .then(() => {
        done();
        void load();
      })
      .catch((err: unknown) => {
        done();
        setActionError(
          err instanceof ApiError ? err.message : "Could not update the plan. Please try again.",
        );
      });
  };

  const handleSwap = (mealId: string) => {
    if (!plan || busyMealId) return;
    setBusyMealId(mealId);
    setActionError(null);
    swapMeal(plan.id, { mealId }, { token })
      .then(() => {
        setBusyMealId(null);
        void load();
      })
      .catch((err: unknown) => {
        setBusyMealId(null);
        setActionError(
          err instanceof ApiError ? err.message : "Could not swap the meal. Please try again.",
        );
      });
  };

  const handleRemove = (mealId: string) => {
    if (confirmRemoveId !== mealId) {
      setConfirmRemoveId(mealId);
      return;
    }
    if (busyMealId) return;
    setBusyMealId(mealId);
    setActionError(null);
    patchMeals(
      (meal) => (meal.mealId === mealId ? null : mealToInput(meal)),
      () => {
        setBusyMealId(null);
        setConfirmRemoveId(null);
      },
    );
  };

  const openMove = (meal: MealPlanMeal) => {
    setMoveId(meal.mealId);
    setMoveDate(meal.date);
    setMoveMealType(meal.mealType);
    setConfirmRemoveId(null);
  };

  const handleMoveApply = (mealId: string) => {
    if (busyMealId) return;
    setBusyMealId(mealId);
    setActionError(null);
    patchMeals(
      (meal) =>
        meal.mealId === mealId
          ? { ...mealToInput(meal), date: moveDate, mealType: moveMealType }
          : mealToInput(meal),
      () => {
        setBusyMealId(null);
        setMoveId(null);
      },
    );
  };

  const handleServings = (mealId: string, delta: 1 | -1) => {
    if (busyMealId || !plan) return;
    const meal = plan.meals.find((m) => m.mealId === mealId);
    if (!meal) return;
    const servings = Math.min(20, Math.max(1, meal.servings + delta));
    if (servings === meal.servings) return;
    setBusyMealId(mealId);
    setActionError(null);
    patchMeals(
      (m) => (m.mealId === mealId ? { ...mealToInput(m), servings } : mealToInput(m)),
      () => setBusyMealId(null),
    );
  };

  const handleToggleFavorite = () => {
    if (!plan || busyMealId) return;
    setActionError(null);
    updateMealPlan(plan.id, { isFavorite: !plan.isFavorite }, { token })
      .then(() => void load())
      .catch((err: unknown) => {
        setActionError(
          err instanceof ApiError ? err.message : "Could not update the plan. Please try again.",
        );
      });
  };

  const handleOptimize = () => {
    if (!plan || optimizing) return;
    setOptimizing(true);
    setActionError(null);
    optimizeMealPlan(plan.id, { token })
      .then(() => {
        setOptimizing(false);
        void load();
      })
      .catch((err: unknown) => {
        setOptimizing(false);
        setActionError(
          err instanceof ApiError ? err.message : "Could not optimize the plan. Please try again.",
        );
      });
  };

  const toggleGenMealType = (value: MealType) => {
    setGenMealsPerDay((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value],
    );
  };

  const toggleGenDiet = (value: DietaryLabel) => {
    setGenDiet((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
    );
  };

  const openGenerate = () => {
    setGenWeekStart(plan?.weekStartDate ?? "");
    setGenDays("7");
    setGenMealsPerDay(["breakfast", "lunch", "dinner"]);
    setGenServings("2");
    setGenCalorie("");
    setGenProtein("");
    setGenDiet([]);
    setGenCuisine("");
    setGenMaxTime("");
    setGenAvoid([]);
    setGenBudget("");
    setGenNotes("");
    setGenPantry(true);
    setGenError(null);
    setGenOpen(true);
  };

  const handleGenerate = () => {
    const days = Number(genDays);
    const servings = Number(genServings);
    if (!genWeekStart || !/^\d{4}-\d{2}-\d{2}$/.test(genWeekStart)) {
      setGenError("Week start date is required (YYYY-MM-DD).");
      return;
    }
    if (!Number.isInteger(days) || days < 1 || days > 7) {
      setGenError("Days must be a whole number from 1 to 7.");
      return;
    }
    if (genMealsPerDay.length === 0) {
      setGenError("Choose at least one meal type per day.");
      return;
    }
    if (!Number.isInteger(servings) || servings < 1 || servings > 20) {
      setGenError("Servings must be a whole number from 1 to 20.");
      return;
    }
    const calorie = genCalorie.trim() ? Number(genCalorie) : null;
    if (calorie !== null && (!Number.isInteger(calorie) || calorie <= 0)) {
      setGenError("Calorie target must be a positive whole number.");
      return;
    }
    const protein = genProtein.trim() ? Number(genProtein) : null;
    if (protein !== null && (!Number.isInteger(protein) || protein <= 0)) {
      setGenError("Protein target must be a positive whole number.");
      return;
    }
    if (genCuisine.trim().length > 50) {
      setGenError("Cuisine must be at most 50 characters.");
      return;
    }
    const maxTime = genMaxTime.trim() ? Number(genMaxTime) : null;
    if (maxTime !== null && (!Number.isInteger(maxTime) || maxTime <= 0)) {
      setGenError("Cooking-time limit must be a positive whole number of minutes.");
      return;
    }
    const budget = genBudget.trim() ? Number(genBudget) : null;
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
      setGenError("Budget must be 0 or greater.");
      return;
    }
    if (genNotes.trim().length > 500) {
      setGenError("Notes must be at most 500 characters.");
      return;
    }
    setGenerating(true);
    setGenError(null);
    const payload: AIGenerateMealPlanInput = {
      weekStartDate: genWeekStart,
      days,
      mealsPerDay: [...genMealsPerDay],
      servings,
      dietaryLabels: [...genDiet],
      prioritizePantry: genPantry,
      avoidIngredients: [...genAvoid],
      ...(calorie !== null ? { calorieTarget: calorie } : {}),
      ...(protein !== null ? { proteinTargetGrams: protein } : {}),
      ...(genCuisine.trim() ? { cuisine: genCuisine.trim() } : {}),
      ...(maxTime !== null ? { maxCookingTimeMinutes: maxTime } : {}),
      ...(budget !== null ? { budget } : {}),
      ...(genNotes.trim() ? { notes: genNotes.trim() } : {}),
    };
    aiGenerateMealPlan(payload, { token })
      .then((created) => {
        setGenerating(false);
        setGenOpen(false);
        router.push(`/meal-plan/${created.id}`);
      })
      .catch((err: unknown) => {
        setGenerating(false);
        setGenError(
          err instanceof ApiError ? err.message : "Could not generate the plan. Please try again.",
        );
      });
  };

  const hasAiMeals = plan?.meals.some((meal) => meal.source !== "manual") ?? false;
  const hasAllergenWarnings =
    plan?.meals.some((meal) => (meal.recipe?.allergenWarnings?.length ?? 0) > 0) ?? false;
  // Deterministic week totals from populated recipes. Recipes without stored
  // nutrition are excluded from the sums (shown as "—" per meal), never NaN.
  const nutritionSummary = (() => {
    if (!plan) return null;
    let kcal = 0;
    let protein = 0;
    let withData = 0;
    for (const meal of plan.meals) {
      const kcalPer = meal.recipe?.nutrition?.["caloriesPerServing"];
      const proteinPer = meal.recipe?.nutrition?.["proteinGramsPerServing"];
      if (typeof kcalPer === "number" && typeof proteinPer === "number") {
        kcal += kcalPer * meal.servings;
        protein += proteinPer * meal.servings;
        withData += 1;
      }
    }
    return {
      kcal: Math.round(kcal),
      protein: Math.round(protein),
      withData,
      total: plan.meals.length,
    };
  })();

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {isLoading ? (
        <LoadingState label="Loading your meal plan…" />
      ) : error || !plan ? (
        <ErrorState
          description={error ?? "Meal plan not found."}
          action={
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => router.push("/meal-plan")}>
                Back to plans
              </Button>
              <Button type="button" variant="outline" onClick={() => void load()}>
                Try again
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Button type="button" variant="outline" onClick={() => router.push("/meal-plan")}>
                ← All plans
              </Button>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
                {plan.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {plan.weekStartDate} → {plan.weekEndDate}
                <Badge variant={plan.status === "archived" ? "neutral" : "success"}>
                  {plan.status === "archived" ? "Archived" : "Active"}
                </Badge>
                {plan.isFavorite && <Badge variant="primary">Favorite</Badge>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleToggleFavorite}>
                {plan.isFavorite ? "★ Favorited" : "☆ Favorite"}
              </Button>
              <Button type="button" variant="outline" onClick={handleOptimize} disabled={optimizing}>
                {optimizing ? "Optimizing…" : "Optimize"}
              </Button>
              <Button type="button" onClick={openGenerate}>
                AI Generate
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/grocery?plan=${plan.id}`)}
              >
                Grocery list
              </Button>
            </div>
          </div>

          {optimizing && (
            <Alert variant="info" title="Optimizing your week">
              The AI is re-balancing pantry use and nutrition. This can take up to a minute.
            </Alert>
          )}

          {actionError && (
            <Alert variant="danger" title="Something went wrong">
              <div className="flex items-start justify-between gap-3">
                <span>{actionError}</span>
                <button
                  type="button"
                  onClick={() => setActionError(null)}
                  aria-label="Dismiss error"
                  className="shrink-0 text-xs font-semibold underline hover:no-underline"
                >
                  Dismiss
                </button>
              </div>
            </Alert>
          )}

          {nutritionSummary && nutritionSummary.total > 0 && (
            <Card className="p-4 sm:p-5">
              <h2 className="text-sm font-bold text-heading">Week nutrition</h2>
              {nutritionSummary.withData === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  No nutrition data for these recipes yet — totals appear once recipes
                  include per-serving values.
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  ≈{nutritionSummary.kcal} kcal · ≈{nutritionSummary.protein}g protein across
                  the week, based on {nutritionSummary.withData} of {nutritionSummary.total}{" "}
                  meals. Recipes without data are excluded, never guessed.
                </p>
              )}
            </Card>
          )}

          {hasAiMeals && <DisclaimerBanner kind="ai" />}
          {hasAllergenWarnings && <DisclaimerBanner kind="allergy" />}
          {plan.meals.length > 0 && <DisclaimerBanner kind="nutrition" />}

          {plan.meals.length === 0 ? (
            <EmptyState
              title="This plan is empty"
              description="Use AI Generate to fill the week, or add meals from your recipes."
              action={
                <Button type="button" onClick={openGenerate}>
                  Generate with AI
                </Button>
              }
            />
          ) : (
            <div className="space-y-6">
              {groupedDays.map((day) => (
                <section key={day.date} aria-label={dayLabel(day.date)}>
                  <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-subtle-foreground">
                    {dayLabel(day.date)}
                  </h2>
                  <ul className="grid gap-3 lg:grid-cols-2">
                    {day.meals.map((meal) => {
                      const busy = busyMealId === meal.mealId;
                      return (
                        <li key={meal.mealId}>
                          <Card className="flex h-full flex-col gap-2 p-4">
                            <div className="flex items-start justify-between gap-2">
                              <Badge variant="neutral" className="capitalize">
                                {formatEnumLabel(meal.mealType)}
                              </Badge>
                              {meal.source !== "manual" && (
                                <Badge variant="outline" title={`Added via ${meal.source}`}>
                                  {formatEnumLabel(meal.source)}
                                </Badge>
                              )}
                            </div>
                            {meal.recipe && !meal.missing ? (
                              <Link
                                href={`/recipes/${meal.recipeId}`}
                                className="text-sm font-semibold text-heading hover:underline"
                              >
                                {meal.recipe.title}
                              </Link>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                <Badge variant="danger">Unavailable</Badge>{" "}
                                <span>This recipe was deleted.</span>
                              </p>
                            )}
                            <p className="text-xs text-subtle-foreground">
                              {meal.servings} serving{meal.servings === 1 ? "" : "s"}
                              {meal.recipe?.nutrition?.caloriesPerServing != null &&
                                ` · ${Math.round(meal.recipe.nutrition.caloriesPerServing * meal.servings)} kcal`}
                            </p>
                            <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                              <div className="flex items-center gap-1" aria-label="Servings">
                                <button
                                  type="button"
                                  onClick={() => handleServings(meal.mealId, -1)}
                                  disabled={busy || meal.servings <= 1}
                                  aria-label="Fewer servings"
                                  className="flex size-9 items-center justify-center rounded-button text-muted-foreground transition-colors hover:bg-background hover:text-heading disabled:opacity-55"
                                >
                                  <Minus className="size-4" aria-hidden="true" />
                                </button>
                                <span className="w-6 text-center text-sm font-semibold">
                                  {meal.servings}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleServings(meal.mealId, 1)}
                                  disabled={busy || meal.servings >= 20}
                                  aria-label="More servings"
                                  className="flex size-9 items-center justify-center rounded-button text-muted-foreground transition-colors hover:bg-background hover:text-heading disabled:opacity-55"
                                >
                                  <Plus className="size-4" aria-hidden="true" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSwap(meal.mealId)}
                                disabled={busy}
                                className="flex h-9 items-center rounded-button px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-heading disabled:opacity-55"
                              >
                                {busy ? "Working…" : "Swap"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  moveId === meal.mealId ? setMoveId(null) : openMove(meal)
                                }
                                disabled={busy}
                                className="flex h-9 items-center rounded-button px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-heading disabled:opacity-55"
                              >
                                Move
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemove(meal.mealId)}
                                disabled={busy}
                                aria-label={
                                  confirmRemoveId === meal.mealId
                                    ? "Confirm removal of this meal"
                                    : "Remove this meal"
                                }
                                className={`flex size-9 items-center justify-center rounded-button transition-colors disabled:opacity-55 ${
                                  confirmRemoveId === meal.mealId
                                    ? "bg-danger-bg font-semibold text-danger-strong"
                                    : "text-muted-foreground hover:bg-background hover:text-danger-strong"
                                }`}
                              >
                                <TrashBin className="size-4" aria-hidden="true" />
                              </button>
                            </div>
                            {moveId === meal.mealId && (
                              <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                                <Select
                                  aria-label="Move to date"
                                  value={moveDate}
                                  onChange={(e) => setMoveDate(e.target.value)}
                                  disabled={busy}
                                >
                                  {dates.map((d) => (
                                    <option key={d} value={d}>
                                      {d}
                                    </option>
                                  ))}
                                </Select>
                                <Select
                                  aria-label="Move to meal type"
                                  value={moveMealType}
                                  onChange={(e) => setMoveMealType(e.target.value as MealType)}
                                  disabled={busy}
                                >
                                  {MEAL_ORDER.map((t) => (
                                    <option key={t} value={t}>
                                      {formatEnumLabel(t)}
                                    </option>
                                  ))}
                                </Select>
                                <Button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleMoveApply(meal.mealId)}
                                >
                                  Apply
                                </Button>
                              </div>
                            )}
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {genOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => {
            if (!generating) setGenOpen(false);
          }}
        >
          <Card
            role="dialog"
            aria-modal="true"
            aria-label="Generate meal plan with AI"
            className="my-8 w-full max-w-lg p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-heading">Generate with AI</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Creates a new plan — this page stays unchanged. Generation can take up
                  to a minute.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGenOpen(false)}
                disabled={generating}
                aria-label="Close dialog"
                className="flex size-9 items-center justify-center rounded-button text-muted-foreground hover:bg-background hover:text-heading"
              >
                <Xmark className="size-4" aria-hidden="true" />
              </button>
            </div>
            {genError && (
              <div className="mt-4">
                <Alert variant="danger">{genError}</Alert>
              </div>
            )}
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerate();
              }}
            >
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Week start"
                  type="date"
                  required
                  value={genWeekStart}
                  onChange={(e) => setGenWeekStart(e.target.value)}
                  disabled={generating}
                />
                <Input
                  label="Days (1–7)"
                  type="number"
                  required
                  min={1}
                  max={7}
                  step={1}
                  value={genDays}
                  onChange={(e) => setGenDays(e.target.value)}
                  disabled={generating}
                />
              </div>
              <fieldset>
                <legend className="mb-1 text-sm font-semibold text-heading">
                  Meals per day
                </legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {MEAL_ORDER.map((t) => (
                    <Checkbox
                      key={t}
                      id={`gen-meal-${t}`}
                      label={formatEnumLabel(t)}
                      checked={genMealsPerDay.includes(t)}
                      onChange={() => toggleGenMealType(t)}
                      disabled={generating}
                    />
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Servings"
                  type="number"
                  required
                  min={1}
                  max={20}
                  step={1}
                  value={genServings}
                  onChange={(e) => setGenServings(e.target.value)}
                  disabled={generating}
                />
                <Input
                  label="Calories/day"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="e.g. 2000"
                  value={genCalorie}
                  onChange={(e) => setGenCalorie(e.target.value)}
                  disabled={generating}
                />
                <Input
                  label="Protein g/day"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="e.g. 140"
                  value={genProtein}
                  onChange={(e) => setGenProtein(e.target.value)}
                  disabled={generating}
                />
              </div>
              <fieldset>
                <legend className="mb-1 text-sm font-semibold text-heading">
                  Dietary labels
                </legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {DIET_LABELS.map((d) => (
                    <Checkbox
                      key={d}
                      id={`gen-diet-${d}`}
                      label={formatEnumLabel(d)}
                      checked={genDiet.includes(d)}
                      onChange={() => toggleGenDiet(d)}
                      disabled={generating}
                    />
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Cuisine (optional)"
                  maxLength={50}
                  placeholder="e.g. Italian"
                  value={genCuisine}
                  onChange={(e) => setGenCuisine(e.target.value)}
                  disabled={generating}
                />
                <Input
                  label="Max minutes/meal"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="e.g. 30"
                  value={genMaxTime}
                  onChange={(e) => setGenMaxTime(e.target.value)}
                  disabled={generating}
                />
              </div>
              <TagInput
                label="Avoid ingredients (optional)"
                placeholder="Type and press Enter…"
                hint="These are never used, even if it reduces variety."
                value={genAvoid}
                onChange={setGenAvoid}
                maxTags={50}
                maxTagLength={100}
                disabled={generating}
              />
              <Input
                label="Weekly budget $ (optional)"
                type="number"
                min={0}
                step="any"
                placeholder="Display guidance only"
                value={genBudget}
                onChange={(e) => setGenBudget(e.target.value)}
                disabled={generating}
              />
              <Textarea
                label="Notes for the AI (optional)"
                rows={3}
                maxLength={500}
                placeholder="Family preferences, e.g. child needs mild meals…"
                value={genNotes}
                onChange={(e) => setGenNotes(e.target.value)}
                disabled={generating}
              />
              <Checkbox
                id="gen-pantry"
                label="Use my pantry first (prioritize what I already have)"
                checked={genPantry}
                onChange={(e) => setGenPantry(e.target.checked)}
                disabled={generating}
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setGenOpen(false)}
                  disabled={generating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={generating}>
                  {generating ? "Generating…" : "Generate week"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </main>
  );
}

export default function MealPlanDetailPage() {
  return (
    <AuthGuard message="Sign in to view your meal plan.">
      <MealPlanDetailContent />
    </AuthGuard>
  );
}

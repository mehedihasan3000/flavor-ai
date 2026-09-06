"use client";

import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Magnifier, Sparkles } from "@gravity-ui/icons";
import { ApiError, listRecipes } from "@/lib/api";
import type {
  Difficulty,
  DietaryLabel,
  PaginatedResult,
  Recipe,
  RecipeCategory,
  RecipeSort,
} from "@/lib/types";
import { formatEnumLabel } from "@/lib/format";
import { Button, EmptyState, ErrorState, Input, LoadingState, Select, Skeleton } from "@/components/ui";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { TasteMatchPanel } from "@/components/recipes/taste-match-panel";

const CATEGORY_OPTIONS: RecipeCategory[] = [
  "main-course",
  "appetizer",
  "soup",
  "salad",
  "side-dish",
  "baking",
  "beverage",
];

const DIET_OPTIONS: DietaryLabel[] = [
  "vegetarian",
  "vegan",
  "halal",
  "gluten-free",
  "dairy-free",
  "high-protein",
  "low-carb",
  "keto",
];

const DIFFICULTY_OPTIONS: Difficulty[] = ["easy", "medium", "hard"];

const SORT_OPTIONS: ReadonlyArray<{ value: RecipeSort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "highest-rated", label: "Highest rated" },
  { value: "most-popular", label: "Most popular" },
];

const PAGE_SIZE = 12;
const SKELETON_COUNT = 6;

function isRecipeCategory(value: string): value is RecipeCategory {
  return (CATEGORY_OPTIONS as string[]).includes(value);
}
function isDietaryLabel(value: string): value is DietaryLabel {
  return (DIET_OPTIONS as string[]).includes(value);
}
function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTY_OPTIONS as string[]).includes(value);
}
function isRecipeSort(value: string): value is RecipeSort {
  return SORT_OPTIONS.some((option) => option.value === value);
}

function RecipesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const categoryParam = searchParams.get("category") ?? "";
  const category = isRecipeCategory(categoryParam) ? categoryParam : "";
  const cuisine = (searchParams.get("cuisine") ?? "").toLowerCase();
  const dietParam = searchParams.get("diet") ?? "";
  const diet = isDietaryLabel(dietParam) ? dietParam : "";
  const difficultyParam = searchParams.get("difficulty") ?? "";
  const difficulty = isDifficulty(difficultyParam) ? difficultyParam : "";
  const maxCookingTimeMinutes = searchParams.get("maxCookingTimeMinutes") ?? "";
  const sortParam = searchParams.get("sort") ?? "newest";
  const sort = isRecipeSort(sortParam) ? sortParam : "newest";
  const pageParam = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;

  const mode = searchParams.get("mode") === "taste" ? "taste" : "browse";
  const switchMode = (nextMode: "browse" | "taste") => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextMode === "browse") params.delete("mode");
    else params.set("mode", "taste");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  // Free-text filters only apply to the URL (and therefore the search) on submit.
  const [searchInput, setSearchInput] = useState(q);
  const [cuisineInput, setCuisineInput] = useState(cuisine);
  const [maxTimeInput, setMaxTimeInput] = useState(maxCookingTimeMinutes);

  // Keep the free-text inputs in sync when the URL changes from elsewhere
  // (Clear filters, browser back/forward). Deferred to a microtask so the
  // effect body itself never calls setState synchronously.
  useEffect(() => {
    Promise.resolve().then(() => {
      setSearchInput(q);
      setCuisineInput(cuisine);
      setMaxTimeInput(maxCookingTimeMinutes);
    });
  }, [q, cuisine, maxCookingTimeMinutes]);

  const [result, setResult] = useState<PaginatedResult<Recipe> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecipes = useCallback(
    (signal?: AbortSignal) => {
      const maxTime = Number(maxCookingTimeMinutes);
      const hasValidMaxTime = maxCookingTimeMinutes !== "" && Number.isFinite(maxTime) && maxTime > 0;

      // Reset to the loading state inside a microtask (not synchronously in
      // the caller's effect body) before the request goes out.
      return Promise.resolve()
        .then(() => {
          setIsLoading(true);
          setError(null);
        })
        .then(() =>
          listRecipes(
            {
              q: q || undefined,
              category: category || undefined,
              cuisine: cuisine || undefined,
              diet: diet || undefined,
              difficulty: difficulty || undefined,
              maxCookingTimeMinutes: hasValidMaxTime ? maxTime : undefined,
              sort,
              page,
              limit: PAGE_SIZE,
            },
            { signal },
          ),
        )
        .then((data) => {
          setResult(data);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof ApiError ? err.message : "Failed to load recipes. Please try again.");
          setIsLoading(false);
        });
    },
    [q, category, cuisine, diet, difficulty, maxCookingTimeMinutes, sort, page],
  );

  useEffect(() => {
    if (mode !== "browse") return;
    const controller = new AbortController();
    void loadRecipes(controller.signal);
    return () => controller.abort();
  }, [mode, loadRecipes]);

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      params.delete("page");
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextPage <= 1) params.delete("page");
      else params.set("page", String(nextPage));
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    updateParams({
      q: searchInput.trim() || undefined,
      cuisine: cuisineInput.trim() || undefined,
      maxCookingTimeMinutes: maxTimeInput.trim() || undefined,
    });
  };

  const hasActiveFilters = Boolean(q || category || cuisine || diet || difficulty || maxCookingTimeMinutes);

  const clearFilters = () => {
    setSearchInput("");
    setCuisineInput("");
    setMaxTimeInput("");
    router.push(pathname);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
          Discover recipes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search published community recipes, or narrow down by diet, cuisine, and cook time.
        </p>
      </div>

      <div className="mb-6 inline-flex gap-1 rounded-button border border-border bg-card p-1" role="tablist">
        <Button
          type="button"
          variant={mode === "browse" ? "primary" : "outline"}
          size="sm"
          role="tab"
          aria-selected={mode === "browse"}
          className={mode === "browse" ? "" : "border-transparent"}
          onClick={() => switchMode("browse")}
        >
          Browse
        </Button>
        <Button
          type="button"
          variant={mode === "taste" ? "primary" : "outline"}
          size="sm"
          role="tab"
          aria-selected={mode === "taste"}
          className={mode === "taste" ? "" : "border-transparent"}
          onClick={() => switchMode("taste")}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          Match my taste
        </Button>
      </div>

      {mode === "taste" ? (
        <TasteMatchPanel />
      ) : (
        <>
      <form
        onSubmit={handleSearchSubmit}
        className="mb-6 space-y-3 rounded-card border border-border bg-card p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 min-w-0">
            <Input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by title, summary, or ingredient…"
              aria-label="Search recipes"
            />
          </div>
          <div className="w-full sm:w-48 sm:shrink-0">
            <Input
              type="text"
              value={cuisineInput}
              onChange={(event) => setCuisineInput(event.target.value)}
              placeholder="Cuisine, e.g. Italian"
              aria-label="Filter by cuisine"
            />
          </div>
          <div className="w-full sm:w-36 sm:shrink-0">
            <Input
              type="number"
              min={1}
              step={1}
              value={maxTimeInput}
              onChange={(event) => setMaxTimeInput(event.target.value)}
              placeholder="Max minutes"
              aria-label="Maximum total cooking time in minutes"
            />
          </div>
          <Button
            type="submit"
            leadingIcon={<Magnifier className="size-4" aria-hidden="true" />}
            className="w-full sm:w-auto shrink-0"
          >
            Search
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Select
            aria-label="Filter by category"
            value={category}
            onChange={(event) => updateParams({ category: event.target.value })}
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by dietary label"
            value={diet}
            onChange={(event) => updateParams({ diet: event.target.value })}
          >
            <option value="">All diets</option>
            {DIET_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by difficulty"
            value={difficulty}
            onChange={(event) => updateParams({ difficulty: event.target.value })}
          >
            <option value="">Any difficulty</option>
            {DIFFICULTY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Sort recipes by"
            value={sort}
            onChange={(event) => updateParams({ sort: event.target.value })}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
      </form>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only" role="status">
            Loading recipes…
          </span>
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className="space-y-3 rounded-card border border-border bg-card p-4"
            >
              <Skeleton className="aspect-video w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          description={error}
          action={
            <Button type="button" variant="outline" onClick={() => void loadRecipes()}>
              Try again
            </Button>
          }
        />
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          icon={<Magnifier aria-hidden="true" />}
          title="No recipes found"
          description={
            hasActiveFilters
              ? "No published recipes match your search and filters. Try broadening your search."
              : "No recipes have been published yet. Check back soon!"
          }
          action={
            hasActiveFilters ? (
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-4 text-xs text-muted-foreground">
            {result.total} recipe{result.total === 1 ? "" : "s"} found
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>

          {result.totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Recipe results pages">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Previous
              </Button>
              <span className="px-2 text-xs font-medium text-muted-foreground">
                Page {result.page} of {result.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= result.totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}
        </>
      )}
    </main>
  );
}


export default function RecipesPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-4 py-16">
          <LoadingState label="Loading recipes…" />
        </main>
      }
    >
      <RecipesContent />
    </Suspense>
  );
}

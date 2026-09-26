"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { ArrowRight, Flame, Sparkles, Star } from "@gravity-ui/icons";
import { buttonStyles, EmptyState } from "@/components/ui";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { listRecipes } from "@/lib/api";
import type { DietaryLabel, Recipe, RecipeCategory, RecipeSort } from "@/lib/types";
import { Reveal } from "./reveal";

const containerClass = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

const CATEGORY_CHIPS: ReadonlyArray<{ value: RecipeCategory | ""; label: string }> = [
  { value: "", label: "All Categories" },
  { value: "main-course", label: "Main Course" },
  { value: "appetizer", label: "Appetizer" },
  { value: "soup", label: "Soup" },
  { value: "salad", label: "Salad" },
  { value: "side-dish", label: "Side Dish" },
  { value: "baking", label: "Baking" },
  { value: "beverage", label: "Beverage" },
];

const DIETARY_CHIPS: ReadonlyArray<{ value: DietaryLabel | ""; label: string }> = [
  { value: "", label: "All Diets" },
  { value: "vegan", label: "Vegan" },
  { value: "keto", label: "Keto" },
  { value: "gluten-free", label: "Gluten-Free" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "high-protein", label: "High-Protein" },
  { value: "low-carb", label: "Low-Carb" },
];

interface CommunitySectionProps {
  initialRecipes: Recipe[] | null;
}

export function CommunitySection({ initialRecipes }: CommunitySectionProps) {
  const [activeSort, setActiveSort] = useState<RecipeSort>("newest");
  const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | "">("");
  const [selectedDiet, setSelectedDiet] = useState<DietaryLabel | "">("");
  const [recipes, setRecipes] = useState<Recipe[] | null>(initialRecipes);
  const [isLoading, setIsLoading] = useState(false);

  const handleSortChange = async (sort: RecipeSort) => {
    if (sort === activeSort) return;
    setActiveSort(sort);
    setIsLoading(true);
    try {
      const res = await listRecipes({
        sort,
        category: selectedCategory || undefined,
        diet: selectedDiet || undefined,
        limit: 6,
      });
      setRecipes(res.items);
    } catch {
      // Keep existing on failure
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryFilter = async (category: RecipeCategory | "") => {
    setSelectedCategory(category);
    setIsLoading(true);
    try {
      const res = await listRecipes({
        sort: activeSort,
        category: category || undefined,
        diet: selectedDiet || undefined,
        limit: 6,
      });
      setRecipes(res.items);
    } catch {
      // Keep existing
    } finally {
      setIsLoading(false);
    }
  };

  const handleDietFilter = async (diet: DietaryLabel | "") => {
    setSelectedDiet(diet);
    setIsLoading(true);
    try {
      const res = await listRecipes({
        sort: activeSort,
        category: selectedCategory || undefined,
        diet: diet || undefined,
        limit: 6,
      });
      setRecipes(res.items);
    } catch {
      // Keep existing
    } finally {
      setIsLoading(false);
    }
  };

  if (!recipes || (recipes.length === 0 && !selectedCategory && !selectedDiet)) {
    return null; // Hide section if there are no recipes at all
  }

  return (
    <section aria-labelledby="community-heading" className={`${containerClass} py-16 sm:py-24 border-t border-border/80`}>
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3.5 py-1 text-xs font-bold text-primary-strong shadow-2xs">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              Community Cookbook
            </span>
            <h2 id="community-heading" className="mt-3 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
              Fresh culinary creations
            </h2>
            <p className="mt-2 text-sm text-subtle-foreground sm:text-base">
              Explore authentic dishes cooked and shared by home chefs around the world.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Sort Toggle */}
            <div className="inline-flex rounded-xl border border-border/80 bg-card p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => handleSortChange("newest")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  activeSort === "newest"
                    ? "bg-primary-soft text-primary-strong shadow-2xs"
                    : "text-muted-foreground hover:text-heading"
                }`}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span>Latest</span>
              </button>
              <button
                type="button"
                onClick={() => handleSortChange("highest-rated")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  activeSort === "highest-rated"
                    ? "bg-primary-soft text-primary-strong shadow-2xs"
                    : "text-muted-foreground hover:text-heading"
                }`}
              >
                <Flame className="size-3.5" aria-hidden="true" />
                <span>Top Rated</span>
              </button>
            </div>

            <Link
              href="/recipes"
              className="inline-flex items-center gap-1.5 rounded-button text-xs font-bold text-primary-strong hover:text-primary-deep"
            >
              <span>View all</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Filter Chips */}
      <Reveal delay={0.06}>
        <div className="mt-6 flex flex-col gap-3 border-y border-border/70 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Categories:</span>
            {CATEGORY_CHIPS.map((cat) => (
              <button
                key={cat.value || "all-cat"}
                type="button"
                onClick={() => handleCategoryFilter(cat.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  selectedCategory === cat.value
                    ? "bg-primary text-white shadow-2xs"
                    : "border border-border bg-card text-subtle-foreground hover:border-primary/40 hover:text-primary-strong"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Dietary:</span>
            {DIETARY_CHIPS.map((diet) => (
              <button
                key={diet.value || "all-diet"}
                type="button"
                onClick={() => handleDietFilter(diet.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  selectedDiet === diet.value
                    ? "bg-secondary text-white shadow-2xs"
                    : "border border-border bg-card text-subtle-foreground hover:border-secondary/40 hover:text-secondary-strong"
                }`}
              >
                {diet.label}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Recipe Grid with AnimatePresence */}
      <div className="mt-8 min-h-[320px]">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((skel) => (
              <div key={skel} className="h-72 rounded-card border border-border/80 bg-card/60 animate-pulse" />
            ))}
          </div>
        ) : recipes && recipes.length > 0 ? (
          <AnimatePresence mode="wait">
            <m.ul
              key={`${activeSort}-${selectedCategory}-${selectedDiet}`}
              initial={{ opacity: 0.85, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0.85, y: -12 }}
              transition={{ duration: 0.3 }}
              className="grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3"
            >
              {recipes.map((recipe) => (
                <li key={recipe.id}>
                  <RecipeCard recipe={recipe} className="h-full" />
                </li>
              ))}
            </m.ul>
          </AnimatePresence>
        ) : (
          <EmptyState
            icon={<Star />}
            title="No matching recipes found"
            description="Try clearing your category or dietary filters to view all community dishes."
            action={
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory("");
                  setSelectedDiet("");
                  handleSortChange("newest");
                }}
                className={buttonStyles({ variant: "outline" })}
              >
                Reset Filters
              </button>
            }
          />
        )}
      </div>
    </section>
  );
}

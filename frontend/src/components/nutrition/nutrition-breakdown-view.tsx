"use client";

import Link from "next/link";
import {
  Flame,
  ShieldCheck,
  TriangleExclamation,
  Sparkles,
  ArrowRight,
  ChartMixed,
} from "@gravity-ui/icons";
import { Badge, DisclaimerBanner } from "@/components/ui";
import type { FoodPhotoAnalysisResult } from "@/lib/types";

export interface NutritionBreakdownViewProps {
  analysis: FoodPhotoAnalysisResult;
  imageUrl?: string | null;
}

export function NutritionBreakdownView({
  analysis,
  imageUrl,
}: NutritionBreakdownViewProps) {
  const {
    dishName,
    summary,
    detectedFoods,
    totalNutrition,
    macroDistribution,
    dietaryTags,
    allergenWarnings,
    healthInsights,
    suggestedIngredientsForRecipe,
    disclaimer,
  } = analysis;

  const generatorQuery = encodeURIComponent(
    suggestedIngredientsForRecipe.length > 0
      ? suggestedIngredientsForRecipe.join(", ")
      : detectedFoods.map((f) => f.name).join(", "),
  );

  const getConfidenceBadge = (confidence: "high" | "medium" | "low") => {
    switch (confidence) {
      case "high":
        return <Badge variant="secondary">High Confidence</Badge>;
      case "medium":
        return <Badge variant="neutral">Med Confidence</Badge>;
      case "low":
        return <Badge variant="outline">Est. Confidence</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Dish Header Card */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary" className="gap-1.5 py-1">
                <Sparkles className="size-3.5" aria-hidden="true" />
                AI Visual Analysis
              </Badge>
              {dietaryTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="capitalize">
                  {tag}
                </Badge>
              ))}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
              {dishName}
            </h2>
            <p className="text-sm leading-relaxed text-subtle-foreground max-w-2xl">
              {summary}
            </p>
          </div>

          {imageUrl && (
            <div className="size-28 shrink-0 overflow-hidden rounded-2xl border border-border shadow-inner hidden sm:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={dishName}
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Nutritional Summary Highlights */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 transition-all hover:border-primary-strong/40">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
              <Flame className="size-4 text-primary-strong" aria-hidden="true" />
              <span>Calories</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-heading">
              {totalNutrition.calories.estimate}
              <span className="text-xs font-normal text-subtle-foreground ml-1">kcal</span>
            </p>
            <p className="text-[11px] text-subtle-foreground mt-0.5">
              Range: {totalNutrition.calories.min} – {totalNutrition.calories.max} kcal
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 transition-all hover:border-primary-strong/40">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
              <span className="size-2.5 rounded-full bg-blue-500" />
              <span>Protein</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-heading">
              {totalNutrition.proteinGrams.estimate}
              <span className="text-xs font-normal text-subtle-foreground ml-1">g</span>
            </p>
            <p className="text-[11px] text-subtle-foreground mt-0.5">
              {macroDistribution.proteinPercentage}% of total calories
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 transition-all hover:border-primary-strong/40">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
              <span className="size-2.5 rounded-full bg-amber-500" />
              <span>Carbs</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-heading">
              {totalNutrition.carbsGrams.estimate}
              <span className="text-xs font-normal text-subtle-foreground ml-1">g</span>
            </p>
            <p className="text-[11px] text-subtle-foreground mt-0.5">
              {macroDistribution.carbsPercentage}% of total calories
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-background/60 p-4 transition-all hover:border-primary-strong/40">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
              <span className="size-2.5 rounded-full bg-rose-500" />
              <span>Fats</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-heading">
              {totalNutrition.fatGrams.estimate}
              <span className="text-xs font-normal text-subtle-foreground ml-1">g</span>
            </p>
            <p className="text-[11px] text-subtle-foreground mt-0.5">
              {macroDistribution.fatPercentage}% of total calories
            </p>
          </div>
        </div>

        {/* Macro Distribution Stacked Bar */}
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-subtle-foreground">
            <span className="flex items-center gap-1.5 font-semibold text-heading">
              <ChartMixed className="size-3.5" aria-hidden="true" />
              Macronutrient Ratio
            </span>
            <span>Estimated from Plate Proportions</span>
          </div>
          <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-background border border-border">
            <div
              style={{ width: `${macroDistribution.proteinPercentage}%` }}
              className="bg-blue-500 transition-all duration-700"
              title={`Protein: ${macroDistribution.proteinPercentage}%`}
            />
            <div
              style={{ width: `${macroDistribution.carbsPercentage}%` }}
              className="bg-amber-500 transition-all duration-700"
              title={`Carbs: ${macroDistribution.carbsPercentage}%`}
            />
            <div
              style={{ width: `${macroDistribution.fatPercentage}%` }}
              className="bg-rose-500 transition-all duration-700"
              title={`Fats: ${macroDistribution.fatPercentage}%`}
            />
          </div>
          <div className="flex items-center gap-4 text-xs text-subtle-foreground pt-1">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-blue-500" />
              Protein ({macroDistribution.proteinPercentage}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500" />
              Carbs ({macroDistribution.carbsPercentage}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-500" />
              Fat ({macroDistribution.fatPercentage}%)
            </span>
          </div>
        </div>
      </div>

      {/* Detected Foods Table */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h3 className="text-lg font-bold text-heading">
          Identified Plate Components & Portions
        </h3>
        <p className="mt-1 text-xs text-subtle-foreground">
          Individual ingredient detection with estimated portion sizes and individual calories
        </p>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-subtle-foreground">
                <th className="pb-3 pr-4">Food Item</th>
                <th className="pb-3 px-4">Est. Portion</th>
                <th className="pb-3 px-4">Confidence</th>
                <th className="pb-3 px-4 text-right">Calories</th>
                <th className="pb-3 pl-4 text-right">Macros (P / C / F)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {detectedFoods.map((food, idx) => (
                <tr key={idx} className="hover:bg-background/40 transition-colors">
                  <td className="py-3.5 pr-4 font-medium text-heading">
                    {food.name}
                  </td>
                  <td className="py-3.5 px-4 text-subtle-foreground font-mono text-xs">
                    {food.portion}
                  </td>
                  <td className="py-3.5 px-4">
                    {getConfidenceBadge(food.confidence)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-heading">
                    {food.calories} <span className="text-xs font-normal text-subtle-foreground">kcal</span>
                  </td>
                  <td className="py-3.5 pl-4 text-right text-xs font-mono text-subtle-foreground">
                    <span className="text-blue-500 font-semibold">{food.proteinGrams}g</span> /{" "}
                    <span className="text-amber-500 font-semibold">{food.carbsGrams}g</span> /{" "}
                    <span className="text-rose-500 font-semibold">{food.fatGrams}g</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allergen & Health Insights Row */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Health Insights */}
        {healthInsights.length > 0 && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-heading mb-4">
              <ShieldCheck className="size-5 text-secondary-strong" aria-hidden="true" />
              <span>Nutritional Insights</span>
            </div>
            <ul className="space-y-2.5">
              {healthInsights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs leading-relaxed text-subtle-foreground">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-secondary-strong" />
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Allergen Warnings */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold text-heading mb-4">
            <TriangleExclamation className="size-5 text-amber-500" aria-hidden="true" />
            <span>Allergen & Sensitivity Warnings</span>
          </div>
          {allergenWarnings.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {allergenWarnings.map((warning, i) => (
                  <Badge key={i} variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10">
                    {warning}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-subtle-foreground leading-relaxed pt-2">
                Cross-contamination or hidden ingredients cannot be confirmed visually.
              </p>
            </div>
          ) : (
            <p className="text-xs text-subtle-foreground leading-relaxed">
              No common severe allergens directly flagged from visual appearance. Always verify preparation.
            </p>
          )}
        </div>
      </div>

      {/* Synergy Action Card: Turn Photo into Recipe */}
      <div className="relative overflow-hidden rounded-3xl border border-primary-strong/30 bg-primary-soft/20 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 max-w-xl">
            <h3 className="text-lg font-bold text-heading flex items-center gap-2">
              <Sparkles className="size-5 text-primary-strong" aria-hidden="true" />
              Want to cook this dish?
            </h3>
            <p className="text-xs leading-relaxed text-subtle-foreground">
              Turn detected ingredients ({suggestedIngredientsForRecipe.slice(0, 4).join(", ")}
              {suggestedIngredientsForRecipe.length > 4 ? "..." : ""}) into a complete step-by-step FlavorAI recipe.
            </p>
          </div>
          <Link
            href={`/generator?ingredients=${generatorQuery}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-strong px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-deep shadow-md hover:shadow-lg shrink-0"
          >
            <span>Generate Recipe</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Mandatory Disclaimer Banner */}
      <div className="space-y-2">
        <DisclaimerBanner kind="nutrition" />
        {disclaimer && (
          <p className="text-[11px] text-center text-subtle-foreground px-4">
            {disclaimer}
          </p>
        )}
      </div>
    </div>
  );
}

import type { NutritionEstimate } from "@/lib/types";

export interface NutritionBadgeProps {
  nutrition?: NutritionEstimate | null;
  className?: string;
  variant?: "compact" | "detailed";
}

function formatValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return "N/A";
  return `${Math.round(value)}${unit}`;
}

export function NutritionBadge({
  nutrition,
  className = "",
  variant = "detailed",
}: NutritionBadgeProps) {
  if (!nutrition) {
    return (
      <div
        className={`rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center text-xs font-medium text-neutral-500 ${className}`}
        aria-label="Nutrition information unavailable"
      >
        Nutrition estimates unavailable for this recipe
      </div>
    );
  }

  const {
    caloriesPerServing,
    proteinGramsPerServing,
    carbsGramsPerServing,
    fatGramsPerServing,
    fiberGramsPerServing,
    sugarGramsPerServing,
    sodiumMgPerServing,
  } = nutrition;

  if (variant === "compact") {
    return (
      <div
        className={`inline-flex flex-wrap items-center gap-2 text-xs font-medium ${className}`}
        aria-label="Nutrition summary per serving"
      >
        <span className="rounded-md bg-orange-100 px-2 py-1 text-orange-900">
          {formatValue(caloriesPerServing, " kcal")}
        </span>
        <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-900">
          P: {formatValue(proteinGramsPerServing, "g")}
        </span>
        <span className="rounded-md bg-blue-100 px-2 py-1 text-blue-900">
          C: {formatValue(carbsGramsPerServing, "g")}
        </span>
        <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-900">
          F: {formatValue(fatGramsPerServing, "g")}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white p-4 shadow-sm ${className}`}
      aria-label="Detailed nutrition information per serving"
    >
      <div className="mb-3 flex items-center justify-between border-b border-neutral-100 pb-2">
        <h4 className="text-sm font-semibold text-neutral-900">
          Nutrition Facts
        </h4>
        <span className="text-xs text-neutral-500">Per Serving</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-orange-50/80 p-2.5 text-center">
          <div className="text-xs font-medium text-neutral-600">Calories</div>
          <div className="mt-0.5 text-lg font-bold text-orange-900">
            {formatValue(caloriesPerServing, "")}
          </div>
          <div className="text-[10px] text-neutral-500">kcal</div>
        </div>

        <div className="rounded-lg bg-emerald-50/80 p-2.5 text-center">
          <div className="text-xs font-medium text-neutral-600">Protein</div>
          <div className="mt-0.5 text-lg font-bold text-emerald-900">
            {formatValue(proteinGramsPerServing, "")}
          </div>
          <div className="text-[10px] text-neutral-500">grams</div>
        </div>

        <div className="rounded-lg bg-blue-50/80 p-2.5 text-center">
          <div className="text-xs font-medium text-neutral-600">Carbs</div>
          <div className="mt-0.5 text-lg font-bold text-blue-900">
            {formatValue(carbsGramsPerServing, "")}
          </div>
          <div className="text-[10px] text-neutral-500">grams</div>
        </div>

        <div className="rounded-lg bg-amber-50/80 p-2.5 text-center">
          <div className="text-xs font-medium text-neutral-600">Fat</div>
          <div className="mt-0.5 text-lg font-bold text-amber-900">
            {formatValue(fatGramsPerServing, "")}
          </div>
          <div className="text-[10px] text-neutral-500">grams</div>
        </div>
      </div>

      {(fiberGramsPerServing !== undefined ||
        sugarGramsPerServing !== undefined ||
        sodiumMgPerServing !== undefined) && (
        <div className="mt-3 flex flex-wrap gap-4 border-t border-neutral-100 pt-2 text-xs text-neutral-600">
          {fiberGramsPerServing !== undefined && (
            <div>
              <span className="font-medium">Fiber:</span>{" "}
              {formatValue(fiberGramsPerServing, "g")}
            </div>
          )}
          {sugarGramsPerServing !== undefined && (
            <div>
              <span className="font-medium">Sugar:</span>{" "}
              {formatValue(sugarGramsPerServing, "g")}
            </div>
          )}
          {sodiumMgPerServing !== undefined && (
            <div>
              <span className="font-medium">Sodium:</span>{" "}
              {formatValue(sodiumMgPerServing, "mg")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

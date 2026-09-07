import { Badge, Card, DisclaimerBanner } from "@/components/ui";
import type { DietPlanResult } from "@/lib/types";

const BMI_BADGE: Record<DietPlanResult["bmiCategory"], "success" | "warning" | "danger"> = {
  "Underweight": "warning",
  "Normal weight": "success",
  "Overweight": "warning",
  "Obesity": "danger",
};

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/50 p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-heading">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-subtle-foreground">{sub}</p> : null}
    </div>
  );
}

export function DietPlanView({ plan }: { plan: DietPlanResult }) {
  const foodProteinTotal = plan.foodPlan.reduce((sum, item) => sum + item.proteinGrams, 0);

  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-heading">Your nutrition requirements</h2>
          <Badge variant={BMI_BADGE[plan.bmiCategory]}>{plan.bmiCategory}</Badge>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="BMI" value={String(plan.bmi)} sub={plan.bmiCategory} />
          <StatCard label="BMR" value={`${plan.bmrCalories.toLocaleString()}`} sub="kcal / day at rest" />
          <StatCard
            label="Daily calories"
            value={`${plan.dailyCalories.toLocaleString()}`}
            sub="kcal / day with activity"
          />
          <StatCard
            label="Daily protein"
            value={`${plan.protein.estimate} g`}
            sub={`range ${plan.protein.min}–${plan.protein.max} g`}
          />
        </div>
      </Card>

      {/* Practical food plan */}
      <Card className="p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-heading">Practical daily protein plan</h2>
          <p className="text-xs text-subtle-foreground">
            ≈ {foodProteinTotal} g protein from the portions below
          </p>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-subtle-foreground">
          Spread these portions across your meals to help meet your target of{" "}
          <span className="font-semibold text-heading">{plan.protein.estimate} g</span> protein per
          day.
        </p>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-105 text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-background/60 text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-semibold">Food</th>
                <th scope="col" className="px-4 py-3 font-semibold">Daily portion</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Protein</th>
              </tr>
            </thead>
            <tbody>
              {plan.foodPlan.map((item, idx) => (
                <tr key={`${item.food}-${idx}`} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-heading">{item.food}</p>
                    {item.note ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-subtle-foreground">{item.portion}</td>
                  <td className="px-4 py-3 text-right font-bold text-heading">
                    {item.proteinGrams} g
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <DisclaimerBanner kind="nutrition">{plan.disclaimer}</DisclaimerBanner>
    </div>
  );
}

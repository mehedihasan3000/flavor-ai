"use client";

import { useEffect, useState } from "react";
import { ArrowRotateRight, Sparkles, TriangleExclamation } from "@gravity-ui/icons";
import { AuthGuard } from "@/components/auth";
import { DietPlanView } from "@/components/nutrition/diet-plan-view";
import { Alert, Button, Input, Select, Spinner } from "@/components/ui";
import { getDietPlan, getMyProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type {
  ActivityLevel,
  DietaryLabel,
  DietPlanInput,
  DietPlanResult,
  Sex,
} from "@/lib/types";

const ACTIVITY_OPTIONS: ReadonlyArray<{ value: ActivityLevel; label: string }> = [
  { value: "sedentary", label: "Sedentary — little or no exercise" },
  { value: "light", label: "Light — 1–3 days / week" },
  { value: "moderate", label: "Moderate — 3–5 days / week" },
  { value: "active", label: "Active — 6–7 days / week" },
  { value: "very-active", label: "Very active — hard exercise daily" },
];

const DIETARY_OPTIONS: ReadonlyArray<{ value: DietaryLabel; label: string }> = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "halal", label: "Halal" },
  { value: "gluten-free", label: "Gluten-free" },
  { value: "dairy-free", label: "Dairy-free" },
  { value: "high-protein", label: "High-protein" },
  { value: "low-carb", label: "Low-carb" },
  { value: "keto", label: "Keto" },
];

interface FieldErrors {
  age?: string;
  weightKg?: string;
  heightCm?: string;
}

function validateField(name: keyof FieldErrors, raw: string): string | undefined {
  if (!raw.trim()) return "This field is required.";
  const value = Number(raw);
  if (!Number.isFinite(value)) return "Enter a valid number.";
  if (name === "age" && (!Number.isInteger(value) || value < 1 || value > 120)) {
    return "Age must be a whole number between 1 and 120.";
  }
  if (name === "weightKg" && (value < 20 || value > 300)) {
    return "Weight must be between 20 and 300 kg.";
  }
  if (name === "heightCm" && (value < 50 || value > 250)) {
    return "Height must be between 50 and 250 cm.";
  }
  return undefined;
}

export default function DietPlanPage() {
  const { token, isLoading: authLoading } = useAuth();

  const [age, setAge] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [sex, setSex] = useState<Sex>("male");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [dietaryPreference, setDietaryPreference] = useState<DietaryLabel | "">("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<DietPlanResult | null>(null);

  // Best-effort prefill of the optional dietary preference from the profile.
  useEffect(() => {
    if (authLoading) return;
    if (!token) return;
    getMyProfile({ token })
      .then((profile) => {
        const first = profile.preferences?.dietaryLabels?.[0];
        if (first) setDietaryPreference(first);
      })
      .catch(() => {
        // Silent — the select simply stays on "No preference".
      });
  }, [authLoading, token]);

  const handleCalculate = () => {
    const errors: FieldErrors = {
      age: validateField("age", age),
      weightKg: validateField("weightKg", weightKg),
      heightCm: validateField("heightCm", heightCm),
    };
    const cleaned: FieldErrors = Object.fromEntries(
      Object.entries(errors).filter(([, v]) => v !== undefined),
    ) as FieldErrors;
    setFieldErrors(cleaned);
    setError(null);
    if (Object.keys(cleaned).length > 0) return;

    const input: DietPlanInput = {
      age: Number(age),
      weightKg: Number(weightKg),
      heightCm: Number(heightCm),
      sex,
      activityLevel,
      ...(dietaryPreference ? { dietaryPreference } : {}),
    };

    setCalculating(true);
    getDietPlan(input, token ? { token } : {})
      .then((result) => {
        setPlan(result);
        setCalculating(false);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to calculate your diet plan. Please try again.",
        );
        setCalculating(false);
      });
  };

  const handleReset = () => {
    setPlan(null);
    setError(null);
    setFieldErrors({});
  };

  return (
    <AuthGuard message="Sign in to calculate your personalized diet plan and nutrition requirements.">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Hero */}
        <div className="mb-8 space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3.5 py-1 text-xs font-semibold text-primary-strong">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Personalized Diet Plan &amp; Nutrition Calculator</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
            Know Your Daily Nutrition Needs
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-subtle-foreground">
            Enter your age, weight, height, sex, and activity level. FlavorAI estimates your BMI,
            metabolic rate, and daily calorie &amp; protein targets — plus a practical food plan to
            help you meet them.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6">
            <Alert variant="danger">
              <div className="flex items-center gap-2">
                <TriangleExclamation className="size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            </Alert>
          </div>
        )}

        {!plan ? (
          <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Input
                label="Age"
                type="number"
                required
                min={1}
                max={120}
                placeholder="e.g. 30"
                hint="Years"
                value={age}
                error={fieldErrors.age}
                onChange={(e) => setAge(e.target.value)}
                disabled={calculating}
              />
              <Select
                label="Sex"
                required
                value={sex}
                onChange={(e) => setSex(e.target.value as Sex)}
                disabled={calculating}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
              <Input
                label="Weight"
                type="number"
                required
                min={20}
                max={300}
                step="0.1"
                placeholder="e.g. 70"
                hint="Kilograms (kg)"
                value={weightKg}
                error={fieldErrors.weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                disabled={calculating}
              />
              <Input
                label="Height"
                type="number"
                required
                min={50}
                max={250}
                step="0.1"
                placeholder="e.g. 175"
                hint="Centimeters (cm)"
                value={heightCm}
                error={fieldErrors.heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                disabled={calculating}
              />
              <Select
                label="Activity level"
                required
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                disabled={calculating}
              >
                {ACTIVITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <Select
                label="Dietary preference (optional)"
                value={dietaryPreference}
                onChange={(e) => setDietaryPreference(e.target.value as DietaryLabel | "")}
                disabled={calculating}
                hint="Filters the suggested protein foods"
              >
                <option value="">No preference</option>
                {DIETARY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="pt-6">
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center font-bold shadow-md hover:shadow-lg"
                onClick={handleCalculate}
                disabled={calculating}
              >
                {calculating ? (
                  <>
                    <Spinner className="mr-2 size-4" />
                    <span>Calculating Your Plan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 size-4" />
                    <span>Calculate My Diet Plan</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                <ArrowRotateRight className="size-3.5" aria-hidden="true" />
                <span>Calculate Again</span>
              </Button>
            </div>
            <DietPlanView plan={plan} />
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

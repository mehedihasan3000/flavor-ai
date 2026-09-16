"use client";

import { useState } from "react";
import { Sparkles, Magnifier } from "@gravity-ui/icons";
import { ApiError, matchRecipesToTaste } from "@/lib/api";
import type { TasteIntensity, TasteMatchResult, TasteProfile } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { AuthPrompt } from "@/components/auth";
import { Alert, Button, Card, DisclaimerBanner, EmptyState, Select, Skeleton, Textarea } from "@/components/ui";
import { RecipeCard } from "./recipe-card";

const TASTE_OPTIONS: ReadonlyArray<{ value: TasteProfile; label: string; emoji: string }> = [
  { value: "spicy", label: "Spicy", emoji: "🌶️" },
  { value: "sweet", label: "Sweet", emoji: "🍯" },
  { value: "salty", label: "Salty", emoji: "🧂" },
  { value: "sour", label: "Sour", emoji: "🍋" },
  { value: "bitter", label: "Bitter", emoji: "☕" },
  { value: "umami", label: "Umami", emoji: "🍄" },
];

const INTENSITY_OPTIONS: ReadonlyArray<{ value: TasteIntensity; label: string }> = [
  { value: "mild", label: "Mild" },
  { value: "medium", label: "Medium" },
  { value: "strong", label: "Strong" },
];

const RESULTS_LIMIT = 12;
const SKELETON_COUNT = 3;

/**
 * AI Taste Matcher (FR-TASTE-01..03). Lets a signed-in user pick the flavors
 * they enjoy and asks the backend to AI-rerank a candidate pool of published
 * recipes against those preferences — personalized discovery alongside the
 * existing category/ingredient filters on /recipes.
 */
export function TasteMatchPanel() {
  const { isAuthenticated, token } = useAuth();
  const [selectedTastes, setSelectedTastes] = useState<TasteProfile[]>([]);
  const [intensity, setIntensity] = useState<TasteIntensity | "">("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TasteMatchResult[] | null>(null);

  const toggleTaste = (taste: TasteProfile) => {
    setSelectedTastes((prev) =>
      prev.includes(taste) ? prev.filter((value) => value !== taste) : [...prev, taste],
    );
  };

  const handleFindMatches = async () => {
    if (selectedTastes.length === 0) {
      setError("Select at least one taste to find matching recipes.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setResults(null);
    try {
      const { matches } = await matchRecipesToTaste(
        {
          tastes: selectedTastes,
          intensity: intensity || undefined,
          notes: notes.trim() || undefined,
          limit: RESULTS_LIMIT,
        },
        { token },
      );
      setResults(matches);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to find taste matches. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <AuthPrompt
        actionName="use the AI Taste Matcher"
        description="Sign in to describe the flavors you love and get AI-recommended recipes that match your taste."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <div>
          <h2 className="text-sm font-semibold text-heading">What flavors do you love?</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick one or more tastes and AI will recommend published recipes that match — a more
            personalized way to discover recipes than category or ingredient filters alone.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Taste preferences">
          {TASTE_OPTIONS.map((option) => {
            const isSelected = selectedTastes.includes(option.value);
            return (
              <Button
                key={option.value}
                type="button"
                variant={isSelected ? "primary" : "outline"}
                size="sm"
                aria-pressed={isSelected}
                onClick={() => toggleTaste(option.value)}
              >
                <span aria-hidden="true">{option.emoji}</span>
                {option.label}
              </Button>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Overall intensity (optional)"
            value={intensity}
            onChange={(event) => setIntensity(event.target.value as TasteIntensity | "")}
          >
            <option value="">No preference</option>
            {INTENSITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <Textarea
          label="Anything else? (optional)"
          placeholder="e.g. not too oily, prefer noodle or rice dishes"
          value={notes}
          maxLength={300}
          rows={2}
          onChange={(event) => setNotes(event.target.value)}
        />

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <Button
          type="button"
          loading={isLoading}
          onClick={() => void handleFindMatches()}
          leadingIcon={<Sparkles className="size-4" aria-hidden="true" />}
        >
          Find my matches
        </Button>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only" role="status">
            Finding taste matches…
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
            </div>
          ))}
        </div>
      ) : results && results.length > 0 ? (
        <div className="space-y-4">
          <DisclaimerBanner kind="ai" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((match) => (
              <RecipeCard
                key={match.recipe.id}
                recipe={match.recipe}
                matchScore={match.score}
                matchReason={match.reason}
              />
            ))}
          </div>
        </div>
      ) : results ? (
        <EmptyState
          icon={<Magnifier aria-hidden="true" />}
          title="No matching recipes yet"
          description="No published recipes matched those tastes. Try different or broader taste selections."
        />
      ) : null}
    </div>
  );
}

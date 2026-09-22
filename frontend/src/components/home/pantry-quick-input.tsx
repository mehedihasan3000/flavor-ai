"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Sparkles } from "@gravity-ui/icons";
import { Reveal } from "./reveal";

const containerClass = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

const SUGGESTION_CHIPS = [
  { label: "Chicken", emoji: "🍗" },
  { label: "Rice", emoji: "🍚" },
  { label: "Egg", emoji: "🥚" },
  { label: "Tomato", emoji: "🍅" },
  { label: "Garlic", emoji: "🧄" },
  { label: "Avocado", emoji: "🥑" },
];

export function PantryQuickInput() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState("");

  const handleAddChip = (chipLabel: string) => {
    const currentItems = inputValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const exists = currentItems.some(
      (item) => item.toLowerCase() === chipLabel.toLowerCase(),
    );

    if (!exists) {
      const updated = currentItems.length > 0 ? `${inputValue.trim()}, ${chipLabel}` : chipLabel;
      setInputValue(updated);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const sanitized = inputValue
      .split(",")
      .map((item) => item.trim().slice(0, 100))
      .filter(Boolean)
      .slice(0, 20)
      .join(",");

    if (!sanitized) return;

    router.push(`/generator?ingredients=${encodeURIComponent(sanitized)}`);
  };

  return (
    <section aria-labelledby="pantry-input-heading" className={`${containerClass} py-12 sm:py-16`}>
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-primary-soft/30 to-amber-500/10 p-6 sm:p-10 shadow-lg backdrop-blur-xs">
          {/* Ambient Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 size-60 rounded-full bg-primary/10 blur-3xl"
          />

          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-card px-3.5 py-1 text-xs font-bold text-primary-strong shadow-2xs">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              Quick Pantry Finder
            </span>

            <h2
              id="pantry-input-heading"
              className="mt-3 text-2xl font-extrabold tracking-tight text-heading sm:text-3xl"
            >
              What is in your kitchen right now?
            </h2>
            <p className="mt-2 text-sm text-subtle-foreground sm:text-base">
              Enter ingredients or tap quick suggestions to generate instant custom recipes.
            </p>

            {/* Quick Form */}
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="e.g. Chicken, Rice, Tomatoes, Garlic..."
                  aria-label="Enter ingredients separated by commas"
                  className="w-full rounded-2xl border border-border bg-card/90 px-4 py-3.5 text-sm font-medium text-heading placeholder:text-muted-foreground shadow-xs transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:text-base"
                />
              </div>
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary-strong hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <span>Generate Recipe</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </form>

            {/* Suggestion Chips */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Quick Add:</span>
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleAddChip(chip.label)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-semibold text-heading shadow-2xs transition-all hover:border-primary/50 hover:bg-primary-soft hover:text-primary-strong active:scale-95"
                >
                  <Plus className="size-3 text-primary" aria-hidden="true" />
                  <span>{chip.emoji} {chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

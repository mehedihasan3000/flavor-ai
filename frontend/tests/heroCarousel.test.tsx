import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroCarousel } from "../src/components/home/hero-carousel";
import type { Recipe } from "../src/lib/types";

function recipeFixture(overrides: Partial<Recipe> & { id: string; title: string }): Recipe {
  return {
    owner: "u1",
    source: "manual",
    slug: overrides.id,
    ingredients: [],
    steps: [],
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    totalTimeMinutes: 25,
    servings: 2,
    difficulty: "easy",
    category: "main-course",
    tags: [],
    dietaryLabels: [],
    allergenWarnings: [],
    status: "published",
    averageRating: 4.5,
    ratingCount: 3,
    favoriteCount: 0,
    commentCount: 0,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const RECIPES = [
  recipeFixture({ id: "r1", title: "First Dish" }),
  recipeFixture({ id: "r2", title: "Second Dish" }),
];

function progressBar(container: HTMLElement): HTMLElement {
  const bar = container.querySelector('[data-testid="hero-progress"]');
  expect(bar).not.toBeNull();
  return bar as HTMLElement;
}

/** Advance fake time one second at a time so each chained timeout fires,
    React flushes, and the next timeout is scheduled before continuing. */
async function advanceSeconds(n: number) {
  for (let i = 0; i < n; i += 1) {
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
  }
}

describe("HeroCarousel auto-advance + progress sync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-advances after 5s with a constant-velocity CSS sweep", async () => {
    const { container } = render(<HeroCarousel recipes={RECIPES} />);
    expect(screen.getByText("First Dish")).toBeInTheDocument();

    // Pure CSS linear sweep: constant velocity 0% → 100% by construction —
    // no JS ticks, so the final second moves exactly like the first.
    const firstBar = progressBar(container);
    expect(firstBar).toHaveClass("hero-progress-bar");
    expect(firstBar.style.animationDuration).toBe("5s");
    expect(firstBar.style.animationPlayState).toBe("running");

    await advanceSeconds(4);
    expect(screen.getByText(/Auto 1s/)).toBeInTheDocument();
    expect(screen.getByText("First Dish")).toBeInTheDocument();

    await advanceSeconds(1);
    expect(screen.getByText("Second Dish")).toBeInTheDocument();
    expect(screen.queryByText(/Auto 0s/)).not.toBeInTheDocument();

    // The sweep restarts via remount (React key), never rewinds.
    const secondBar = progressBar(container);
    expect(secondBar).not.toBe(firstBar);
    expect(secondBar.style.animationPlayState).toBe("running");
  });

  it("pauses both the slide and the progress sweep on hover", async () => {
    const { container } = render(<HeroCarousel recipes={RECIPES} />);

    await advanceSeconds(2);
    fireEvent.mouseEnter(
      container.querySelector('[aria-roledescription="carousel"]') as HTMLElement,
    );

    // Frozen mid-sweep instead of gliding on.
    expect(progressBar(container).style.animationPlayState).toBe("paused");

    await advanceSeconds(10);

    expect(screen.getByText("First Dish")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("manual navigation restarts the sweep from zero", async () => {
    const { container } = render(<HeroCarousel recipes={RECIPES} />);

    await advanceSeconds(3);
    const firstBar = progressBar(container);

    fireEvent.click(screen.getByRole("button", { name: "Next recipe slide" }));
    expect(screen.getByText("Second Dish")).toBeInTheDocument();

    // Fresh node → the CSS sweep restarts at 0%, no rewind glide.
    const secondBar = progressBar(container);
    expect(secondBar).not.toBe(firstBar);
    expect(secondBar.style.animationPlayState).toBe("running");
  });

  it("renders the fallback showcase when there are no recipes", () => {
    const { container } = render(<HeroCarousel recipes={[]} />);
    expect(screen.getByText("Artisan Kitchen Showcase")).toBeInTheDocument();
    expect(container.querySelector('[data-testid="hero-progress"]')).toBeNull();
  });
});

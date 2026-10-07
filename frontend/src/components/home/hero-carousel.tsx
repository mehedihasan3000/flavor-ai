"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles, Star } from "@gravity-ui/icons";
import type { Recipe } from "@/lib/types";
import { HeroFloat } from "./hero-motion";

interface HeroCarouselProps {
  recipes: Recipe[];
}

/** Seconds each slide stays visible before auto-advancing. */
const AUTO_ADVANCE_SECONDS = 5;

const DEFAULT_FALLBACK_RECIPE: Partial<Recipe> = {
  id: "default-hero",
  title: "Artisan Kitchen Showcase",
  imageUrl: "/images/spicy-meat.jpg",
  category: "main-course",
  totalTimeMinutes: 25,
  averageRating: 4.9,
  ratingCount: 12,
};

export function HeroCarousel({ recipes }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_ADVANCE_SECONDS);
  const [isHovered, setIsHovered] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const displayRecipes = recipes.length > 0 ? recipes : [DEFAULT_FALLBACK_RECIPE as Recipe];
  const count = displayRecipes.length;
  const currentRecipe = displayRecipes[activeIndex] ?? displayRecipes[0];

  const handlePrev = useCallback(() => {
    setSecondsLeft(AUTO_ADVANCE_SECONDS);
    setActiveIndex((prev) => (prev === 0 ? count - 1 : prev - 1));
  }, [count]);

  const handleNext = useCallback(() => {
    setSecondsLeft(AUTO_ADVANCE_SECONDS);
    setActiveIndex((prev) => (prev + 1) % count);
  }, [count]);

  const handleSelectDot = (idx: number) => {
    setSecondsLeft(AUTO_ADVANCE_SECONDS);
    setActiveIndex(idx);
  };

  // 1-second tick-down that drives both the auto-advance and the progress bar,
  // so the two can never desync. Pauses on hover. Advancing and resetting
  // happen together in one cancelable timeout, so `secondsLeft` never renders
  // 0 and hover/unmount always cancels the hop. Zero synchronous setState
  // inside the effect body (React Compiler rules).
  useEffect(() => {
    if (count <= 1 || isHovered) return;
    if (secondsLeft <= 1) {
      const timer = setTimeout(() => {
        setActiveIndex((current) => (current + 1) % count);
        setSecondsLeft(AUTO_ADVANCE_SECONDS);
      }, 1000);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [count, isHovered, secondsLeft]);

  // Warm the browser cache for upcoming slides so transitions never pop in
  // a half-loaded image mid-crossfade. Keyed on the URL content (not array
  // identity) so re-renders with the same images don't re-warm; covers the
  // empty-state fallback too.
  const imageUrlKey = recipes.map((r) => r.imageUrl ?? "").join("\n");
  useEffect(() => {
    const urls = new Set(imageUrlKey.split("\n").filter(Boolean));
    if (urls.size === 0) {
      const fallback = DEFAULT_FALLBACK_RECIPE.imageUrl;
      if (fallback) urls.add(fallback);
    }
    for (const url of urls) {
      const img = new Image();
      img.src = url;
    }
  }, [imageUrlKey]);

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  const hasImage = currentRecipe?.imageUrl && !imageErrors[currentRecipe.id];
  const recipeTitle = currentRecipe?.title ?? "Artisan Kitchen Showcase";
  const recipeCategory = currentRecipe?.category ? currentRecipe.category.replace("-", " ") : "Community Favorite";
  const recipeTime = currentRecipe?.totalTimeMinutes ? `${currentRecipe.totalTimeMinutes} min` : "Quick & Easy";

  return (
    <div className="relative flex justify-center lg:col-span-6 lg:justify-end w-full">
      {/* Ambient background glow */}
      <div
        aria-hidden="true"
        className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-primary/25 via-amber-400/25 to-secondary/20 blur-3xl -z-10"
      />

      {/* NOTE: deliberately no float wrapper around the whole card — animating
          a transform loop over this large layer (image + blurs + shadows) every
          frame caused visible jank. Only the small rating badge floats. */}
      <div className="w-full flex justify-center lg:justify-end">
        <div
          className="relative w-full max-w-lg sm:max-w-xl lg:max-w-2xl xl:max-w-3xl"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-roledescription="carousel"
          aria-label="Top rated community recipes slider"
        >
          {/* Prominent Showcase Card Container. NOTE: no hover zoom on the card
              itself — scaling this layer (overflow-hidden + backdrop-blur
              children + hairline borders) to fractional pixels opened a
              subpixel seam at the image/nav junction (the thin white line) and
              made the bottom controls shimmer while repainting. The image keeps
              its own contained zoom below, which can't seam. */}
          <div className="group relative overflow-hidden rounded-[2rem] border border-white/80 bg-card shadow-2xl">

            {/* Visual Sync Countdown Progress Bar — a pure CSS linear sweep
                (see .hero-progress-bar in globals.css). Constant velocity from
                0% to 100% by construction: no JS ticks, no retargeting, so the
                final second moves exactly like the first. Duration matches the
                auto-advance cycle; the React key restarts the sweep per slide,
                and animationPlayState freezes it mid-sweep on hover. The slide
                switch itself stays timeout-driven right below. */}
            {count > 1 && (
              <div className="absolute top-0 left-0 right-0 z-20 h-1.5 w-full bg-black/30 backdrop-blur-xs overflow-hidden">
                <div
                  key={activeIndex}
                  aria-hidden="true"
                  data-testid="hero-progress"
                  className="hero-progress-bar h-full w-full bg-gradient-to-r from-amber-400 via-primary to-amber-500 shadow-sm"
                  style={{
                    animationDuration: `${AUTO_ADVANCE_SECONDS}s`,
                    animationPlayState: isHovered ? "paused" : "running",
                  }}
                />
              </div>
            )}

            <div className="relative aspect-square sm:aspect-[4/3] lg:aspect-[4/3] w-full overflow-hidden">
              {/* Default (sync) crossfade: slides are absolutely positioned, so the
                  outgoing and incoming slides overlap with no blank gap. The old
                  mode="wait" forced a visible empty flash between slides. */}
              <AnimatePresence initial={false}>
                <m.div
                  key={currentRecipe?.id ?? activeIndex}
                  initial={{ opacity: 0, x: 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -32 }}
                  transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                  className="absolute inset-0 h-full w-full"
                >
                  {hasImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentRecipe.imageUrl}
                      alt={recipeTitle}
                      onError={() => handleImageError(currentRecipe.id)}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-soft via-amber-100/50 to-secondary-soft">
                      <Sparkles className="size-20 text-primary/40" aria-hidden="true" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent opacity-95" />

                  {/* Dish Details Overlay */}
                  <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-white drop-shadow-lg">
                    <div className="max-w-[70%]">
                      {currentRecipe?.id && currentRecipe.id !== "default-hero" ? (
                        <Link
                          href={`/recipes/${currentRecipe.id}`}
                          className="truncate text-lg sm:text-xl font-extrabold transition-colors hover:text-amber-300 hover:underline block"
                        >
                          {recipeTitle}
                        </Link>
                      ) : (
                        <p className="truncate text-lg sm:text-xl font-extrabold">{recipeTitle}</p>
                      )}
                      <p className="text-xs sm:text-sm text-white/90 capitalize mt-1 font-medium">{recipeCategory}</p>
                    </div>
                    <span className="rounded-full bg-white/25 px-3 py-1.5 text-xs font-bold backdrop-blur-md shadow-xs">
                      {recipeTime}
                    </span>
                  </div>
                </m.div>
              </AnimatePresence>

              {/* Status Countdown Text Badge with ticking seconds (Top Right) */}
              {count > 1 && (
                <div className="absolute top-4 right-4 z-10">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md transition-colors ${
                      isHovered ? "bg-black/75 border border-amber-400/50" : "bg-black/50 border border-white/20"
                    }`}
                  >
                    <span
                      className={`size-2 rounded-full ${
                        isHovered ? "bg-amber-400" : "bg-emerald-400 animate-pulse"
                      }`}
                      aria-hidden="true"
                    />
                    <span>{isHovered ? "Paused" : `Auto ${secondsLeft}s (${activeIndex + 1}/${count})`}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Navigation Controls Bar */}
            {count > 1 && (
              <div className="flex items-center justify-between border-t border-white/10 bg-black/50 px-5 py-3 backdrop-blur-md">
                {/* Arrow Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous recipe slide"
                    className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-95"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next recipe slide"
                    className="flex size-8 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-95"
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Dot Indicators */}
                <div className="flex items-center gap-2" role="tablist" aria-label="Slide dots">
                  {displayRecipes.map((r, idx) => (
                    <button
                      key={r.id ?? idx}
                      type="button"
                      role="tab"
                      aria-selected={idx === activeIndex}
                      aria-label={`Go to slide ${idx + 1}: ${r.title}`}
                      onClick={() => handleSelectDot(idx)}
                      className={`h-2.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        idx === activeIndex
                          ? "w-7 bg-amber-400 shadow-xs"
                          : "w-2.5 bg-white/40 hover:bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top Rating Badge Overlay — the only floating element: small and cheap */}
          {currentRecipe && (
            <HeroFloat delay={0.3} className="absolute -left-3 -top-5 sm:-left-6 sm:-top-6 z-30">
              <div className="rounded-card border border-border/80 bg-card/95 p-3.5 shadow-xl backdrop-blur-md transition-transform hover:-translate-y-1">
                <div className="flex items-center gap-1.5 text-amber-500">
                  {/* text-* (not fill-*): the Star path is fill="currentColor",
                      so only the CSS color property recolors it. */}
                  <Star className="size-4.5 text-amber-500" aria-hidden="true" />
                  <span className="text-sm font-extrabold text-heading">
                    {currentRecipe.averageRating > 0
                      ? currentRecipe.averageRating.toFixed(1)
                      : "Top Rated"}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    ({currentRecipe.ratingCount ?? 0}{" "}
                    {currentRecipe.ratingCount === 1 ? "rating" : "ratings"})
                  </span>
                </div>
              </div>
            </HeroFloat>
          )}
        </div>
      </div>
    </div>
  );
}

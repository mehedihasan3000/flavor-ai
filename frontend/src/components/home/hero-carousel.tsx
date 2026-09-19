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
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [isHovered, setIsHovered] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const displayRecipes = recipes.length > 0 ? recipes : [DEFAULT_FALLBACK_RECIPE as Recipe];
  const count = displayRecipes.length;
  const currentRecipe = displayRecipes[activeIndex] ?? displayRecipes[0];

  const handlePrev = useCallback(() => {
    setSecondsLeft(5);
    setActiveIndex((prev) => (prev === 0 ? count - 1 : prev - 1));
  }, [count]);

  const handleNext = useCallback(() => {
    setSecondsLeft(5);
    setActiveIndex((prev) => (prev + 1) % count);
  }, [count]);

  const handleSelectDot = (idx: number) => {
    setSecondsLeft(5);
    setActiveIndex(idx);
  };

  // 1-Second tick-down timer that syncs the 5s auto-sliding carousel & visual countdown.
  // Zero synchronous setState inside useEffect body.
  useEffect(() => {
    if (count <= 1 || isHovered) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setActiveIndex((current) => (current + 1) % count);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [count, isHovered]);

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  const hasImage = currentRecipe?.imageUrl && !imageErrors[currentRecipe.id];
  const recipeTitle = currentRecipe?.title ?? "Artisan Kitchen Showcase";
  const recipeCategory = currentRecipe?.category ? currentRecipe.category.replace("-", " ") : "Community Favorite";
  const recipeTime = currentRecipe?.totalTimeMinutes ? `${currentRecipe.totalTimeMinutes} min` : "Quick & Easy";

  return (
    <div className="relative flex justify-center lg:col-span-5 lg:justify-end w-full">
      {/* Ambient background glow */}
      <div
        aria-hidden="true"
        className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-primary/25 via-amber-400/25 to-secondary/20 blur-3xl -z-10"
      />

      <HeroFloat delay={0} className="w-full flex justify-center lg:justify-end">
        <div
          className="relative w-full max-w-md sm:max-w-lg lg:max-w-xl xl:max-w-2xl"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-roledescription="carousel"
          aria-label="Top rated community recipes slider"
        >
          {/* Prominent Showcase Card Container */}
          <div className="group relative overflow-hidden rounded-[2rem] border border-white/80 bg-card shadow-2xl transition-transform duration-500 hover:scale-[1.01]">
            
            {/* Visual 5-Second Sync Countdown Progress Bar */}
            {count > 1 && (
              <div className="absolute top-0 left-0 right-0 z-20 h-1.5 w-full bg-black/30 backdrop-blur-xs overflow-hidden">
                <m.div
                  key={`progress-${activeIndex}-${isHovered}`}
                  initial={{ width: "0%" }}
                  animate={{ width: isHovered ? "0%" : "100%" }}
                  transition={{
                    duration: isHovered ? 0 : 5,
                    ease: "linear",
                  }}
                  className="h-full bg-gradient-to-r from-amber-400 via-primary to-amber-500 shadow-sm"
                />
              </div>
            )}

            <div className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/11]">
              <AnimatePresence mode="wait" initial={false}>
                <m.div
                  key={currentRecipe?.id ?? activeIndex}
                  initial={{ opacity: 0, x: 25 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -25 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
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

          {/* Top Rating Badge Overlay */}
          {currentRecipe && (
            <HeroFloat delay={0.3} className="absolute -left-3 -top-5 sm:-left-6 sm:-top-6 z-30">
              <div className="rounded-card border border-border/80 bg-card/95 p-3.5 shadow-xl backdrop-blur-md transition-transform hover:-translate-y-1">
                <div className="flex items-center gap-1.5 text-amber-500">
                  <Star className="size-4.5 fill-amber-500" aria-hidden="true" />
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
      </HeroFloat>
    </div>
  );
}

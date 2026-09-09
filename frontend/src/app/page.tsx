import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Check,
  Clock,
  Flame,
  Heart,
  Sliders,
  Sparkles,
  Star,
  Target,
} from "@gravity-ui/icons";
import { buttonStyles, EmptyState } from "@/components/ui";
import { RecipeCard } from "@/components/recipes/recipe-card";
import { listRecipes } from "@/lib/api";
import type { Recipe } from "@/lib/types";

const containerClass = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

/**
 * Fetches up to 3 of the newest published recipes for the featured section.
 * Returns null when the API is unreachable (e.g. during static generation)
 * so the homepage still renders.
 */
async function getFeaturedRecipes(): Promise<Recipe[] | null> {
  try {
    const result = await listRecipes({ sort: "newest", limit: 3 });
    return result.items;
  } catch {
    return null;
  }
}

function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-8 sm:pb-24 sm:pt-14 lg:pb-28 lg:pt-16">
      {/* Ambient background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-[520px] w-full max-w-7xl -translate-x-1/2 opacity-75 blur-3xl"
      >
        <div className="h-full w-full bg-gradient-to-tr from-primary/10 via-amber-200/25 to-secondary/10" />
      </div>

      <div className={containerClass}>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Value proposition, Actions & Social Proof */}
          <div className="flex flex-col items-start text-left lg:col-span-7">
            {/* Eyebrow Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft/90 px-3.5 py-1.5 text-xs font-semibold text-primary-strong shadow-2xs backdrop-blur-xs">
              <span className="flex size-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
              <span>AI Culinary Copilot</span>
              <span className="text-border-strong" aria-hidden="true">
                •
              </span>
              <span className="font-medium text-subtle-foreground">Zero Food Waste</span>
            </div>

            {/* Headline */}
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-heading sm:text-5xl lg:text-[3.65rem] lg:leading-[1.12]">
              Turn your ingredients into{" "}
              <span className="bg-gradient-to-r from-primary via-amber-500 to-primary-strong bg-clip-text text-transparent">
                delicious meals
              </span>{" "}
              <span className="inline-block transition-transform hover:scale-110 duration-200" aria-hidden="true">
                🔥
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-5 max-w-xl text-base leading-relaxed text-subtle-foreground sm:text-lg">
              Tell FlavorAI what is already resting in your kitchen or snap a photo of your plate.
              Get instant, nutrition-aware recipes, cut down grocery waste, and unleash your inner chef in seconds.
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link
                href="/generator"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-button bg-primary px-6 text-base font-semibold text-white shadow-md shadow-primary/25 transition-all hover:bg-primary-strong hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5"
              >
                <Sparkles className="size-4.5" aria-hidden="true" />
                <span>Generate a recipe</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/nutrition-analyzer"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-button border border-border bg-card px-5 text-base font-semibold text-heading shadow-xs transition-all hover:border-primary/50 hover:bg-primary-soft/50 hover:text-primary-strong hover:-translate-y-0.5"
              >
                <Camera className="size-4.5 text-primary" aria-hidden="true" />
                <span>Scan photo nutrition</span>
              </Link>
            </div>

            {/* Secondary Explore Link */}
            <div className="mt-4">
              <Link
                href="/recipes"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary-strong"
              >
                <span>Browse 100+ community recipes</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            {/* Social Proof & Key Metric Cards */}
            <div className="mt-10 grid w-full grid-cols-3 gap-2.5 border-t border-border pt-8 sm:gap-4">
              <div className="flex flex-col rounded-card border border-border/80 bg-card/80 p-3 sm:p-3.5 shadow-2xs backdrop-blur-xs">
                <div className="flex items-center gap-1.5 text-amber-500">
                  <Star className="size-4 fill-amber-500" aria-hidden="true" />
                  <span className="text-sm font-bold text-heading sm:text-base">4.9 / 5</span>
                </div>
                <span className="mt-1 text-xs text-muted-foreground">15K+ Cook Reviews</span>
              </div>

              <div className="flex flex-col rounded-card border border-border/80 bg-card/80 p-3 sm:p-3.5 shadow-2xs backdrop-blur-xs">
                <div className="flex items-center gap-1.5 text-primary">
                  <Flame className="size-4 text-primary" aria-hidden="true" />
                  <span className="text-sm font-bold text-heading sm:text-base">50K+</span>
                </div>
                <span className="mt-1 text-xs text-muted-foreground">Recipes Generated</span>
              </div>

              <div className="flex flex-col rounded-card border border-border/80 bg-card/80 p-3 sm:p-3.5 shadow-2xs backdrop-blur-xs">
                <div className="flex items-center gap-1.5 text-secondary-strong">
                  <Target className="size-4 text-secondary-strong" aria-hidden="true" />
                  <span className="text-sm font-bold text-heading sm:text-base">98%</span>
                </div>
                <span className="mt-1 text-xs text-muted-foreground">Pantry Match Rate</span>
              </div>
            </div>
          </div>

          {/* Right Column: Culinary Presentation & Interactive Overlays */}
          <div className="relative flex justify-center lg:col-span-5 lg:justify-end">
            {/* Ambient visual glow behind hero image */}
            <div
              aria-hidden="true"
              className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-primary/20 via-amber-400/20 to-secondary/15 blur-2xl -z-10"
            />

            {/* Main Showcase Container */}
            <div className="relative w-full max-w-md sm:max-w-lg lg:max-w-none">
              <div className="group relative overflow-hidden rounded-[2rem] border border-white/80 bg-card shadow-2xl transition-transform duration-500 hover:scale-[1.01]">
                <Image
                  src="/images/spicy-meat.jpg"
                  alt="Delicious vibrant culinary dish with fresh wholesome ingredients created by FlavorAI"
                  width={640}
                  height={640}
                  priority
                  className="aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-70" />

                {/* Dish Caption Overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white drop-shadow-md">
                  <div>
                    <p className="text-sm font-bold">Artisan Harvest Grain Bowl</p>
                    <p className="text-xs text-white/90">Created from 5 pantry ingredients</p>
                  </div>
                  <span className="rounded-full bg-white/25 px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
                    25 min
                  </span>
                </div>
              </div>

              {/* Floating Badge 1: Top Left - Instant AI Match */}
              <div className="absolute -left-3 -top-5 sm:-left-6 sm:-top-6 rounded-card border border-border/80 bg-card/95 p-3.5 shadow-xl backdrop-blur-md transition-transform hover:-translate-y-1 sm:max-w-[215px]">
                <div className="flex items-center gap-2">
                  <span className="flex size-2 rounded-full bg-secondary animate-ping" aria-hidden="true" />
                  <span className="text-xs font-bold text-secondary-strong">98% Pantry Match</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded bg-secondary-soft px-1.5 py-0.5 text-[10px] font-medium text-secondary-deep">
                    ✓ Chicken
                  </span>
                  <span className="rounded bg-secondary-soft px-1.5 py-0.5 text-[10px] font-medium text-secondary-deep">
                    ✓ Greens
                  </span>
                  <span className="rounded bg-secondary-soft px-1.5 py-0.5 text-[10px] font-medium text-secondary-deep">
                    ✓ Garlic
                  </span>
                </div>
              </div>

              {/* Floating Badge 2: Bottom Right - Photo Nutrition Scanner */}
              <div className="absolute -bottom-5 -right-3 sm:-bottom-7 sm:-right-6 rounded-card border border-border/80 bg-card/95 p-3.5 shadow-xl backdrop-blur-md transition-transform hover:-translate-y-1 sm:max-w-[220px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-heading">
                    <Camera className="size-3.5 text-primary" aria-hidden="true" />
                    AI Nutrition Scan
                  </span>
                  <span className="text-[10px] font-semibold text-primary-strong">94% conf.</span>
                </div>
                <div className="mt-2 flex items-baseline justify-between border-t border-border pt-1.5 text-xs font-bold text-heading">
                  <span>420 kcal</span>
                  <span className="text-[11px] font-normal text-muted-foreground">38g Protein · 14g Carbs</span>
                </div>
              </div>

              {/* Floating Badge 3: Top Right - Chef Approved Pill */}
              <div className="hidden sm:flex absolute -right-3 top-6 items-center gap-1.5 rounded-full border border-white/60 bg-card/90 px-3 py-1.5 shadow-lg backdrop-blur-md">
                <Star className="size-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
                <span className="text-xs font-bold text-heading">Chef Approved</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className={`${containerClass} border-t border-border/80 py-16 sm:py-24`}
    >
      {/* Section Header */}
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3.5 py-1 text-xs font-bold text-primary-strong shadow-2xs">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Three-Step Culinary Workflow
        </span>
        <h2
          id="how-it-works-heading"
          className="mt-4 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl"
        >
          From pantry to plate in{" "}
          <span className="bg-gradient-to-r from-primary via-amber-600 to-primary-strong bg-clip-text text-transparent">
            three effortless steps
          </span>
        </h2>
        <p className="mt-3 text-base sm:text-lg leading-relaxed text-subtle-foreground">
          FlavorAI starts with what you already have, not an expensive grocery run. Eliminate food waste and whip up restaurant-quality dishes in minutes.
        </p>
      </div>

      {/* 3 Step Cards Grid */}
      <ol className="mt-12 grid list-none gap-6 sm:gap-8 lg:grid-cols-3">
        {/* Step 1 */}
        <li className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
          <div
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-amber-500 opacity-80 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3 py-1 text-xs font-bold text-primary-strong">
                <Sliders className="size-3.5" aria-hidden="true" />
                Step 01
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pantry Input
              </span>
            </div>

            <h3 className="mt-5 text-xl font-bold tracking-tight text-heading transition-colors group-hover:text-primary">
              Share your pantry
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-subtle-foreground">
              Add the ingredients you have on hand, snap a fridge photo, and set your diet, allergens, cook time, and cooking skill level.
            </p>
          </div>

          {/* Micro-UI: Pantry items & filters */}
          <div className="mt-6 rounded-xl border border-border/80 bg-background/80 p-3.5 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-heading">
                <span className="size-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                Available Ingredients
              </span>
              <span className="rounded-full bg-border/60 px-2 py-0.5 text-[10px] font-medium text-subtle-foreground">
                4 items
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-heading shadow-2xs">
                🥑 Avocado
              </span>
              <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-heading shadow-2xs">
                🍗 Chicken breast
              </span>
              <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-heading shadow-2xs">
                🧄 Garlic cloves
              </span>
              <span className="inline-flex items-center rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-heading shadow-2xs">
                🌿 Fresh basil
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-2.5 text-[11px]">
              <span className="inline-flex items-center gap-1 font-semibold text-secondary-strong">
                <Check className="size-3" aria-hidden="true" />
                Gluten-Free
              </span>
              <span className="text-border-strong" aria-hidden="true">•</span>
              <span className="inline-flex items-center gap-1 font-semibold text-primary-strong">
                <Clock className="size-3" aria-hidden="true" />
                &lt; 25 mins
              </span>
            </div>
          </div>
        </li>

        {/* Step 2 */}
        <li className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-amber-400 hover:shadow-xl">
          <div
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-80 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                <Sparkles className="size-3.5 text-amber-600" aria-hidden="true" />
                Step 02
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                AI Synthesis
              </span>
            </div>

            <h3 className="mt-5 text-xl font-bold tracking-tight text-heading transition-colors group-hover:text-amber-700">
              Get a personalized recipe
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-subtle-foreground">
              AI balances flavor pairings, generates ordered steps, estimates macronutrients, and highlights any optional pantry additions.
            </p>
          </div>

          {/* Micro-UI: Generated Recipe Match */}
          <div className="mt-6 rounded-xl border border-border/80 bg-background/80 p-3.5 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-heading">
                <Sparkles className="size-3.5 text-amber-500" aria-hidden="true" />
                AI Recipe Match
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-secondary/20 bg-secondary-soft px-2 py-0.5 text-[10px] font-bold text-secondary-strong">
                98% Match
              </span>
            </div>
            <div className="mt-2.5 rounded-lg border border-border/70 bg-card p-2.5 shadow-2xs">
              <p className="truncate text-xs font-bold text-heading">Crispy Garlic-Herb Chicken</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-semibold text-primary-strong">420 kcal</span>
                <span aria-hidden="true">•</span>
                <span>38g Protein</span>
                <span aria-hidden="true">•</span>
                <span>14g Carbs</span>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate">Step 1: Sear chicken in infused olive oil...</span>
              <span className="shrink-0 font-semibold text-primary">Chef Ready</span>
            </div>
          </div>
        </li>

        {/* Step 3 */}
        <li className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-secondary/40 hover:shadow-xl">
          <div
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary to-emerald-500 opacity-80 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/20 bg-secondary-soft px-3 py-1 text-xs font-bold text-secondary-strong">
                <Star className="size-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
                Step 03
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cook &amp; Share
              </span>
            </div>

            <h3 className="mt-5 text-xl font-bold tracking-tight text-heading transition-colors group-hover:text-secondary-strong">
              Cook, rate, and share
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-subtle-foreground">
              Save recipes to your private cookbook, publish them to the community, and collect ratings, helpful cooking tips, and favorites.
            </p>
          </div>

          {/* Micro-UI: Social proof & community */}
          <div className="mt-6 rounded-xl border border-border/80 bg-background/80 p-3.5 shadow-2xs backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((starIndex) => (
                  <Star
                    key={starIndex}
                    className="size-3 fill-amber-500 text-amber-500"
                    aria-hidden="true"
                  />
                ))}
                <span className="ml-1 font-bold text-heading">4.9</span>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">48 reviews</span>
            </div>
            <div className="mt-2.5 rounded-lg border border-border/70 bg-card p-2.5 shadow-2xs">
              <p className="text-xs italic text-subtle-foreground">
                &ldquo;Turned leftover chicken into a gourmet dinner in 20 minutes!&rdquo;
              </p>
              <p className="mt-1 text-[11px] font-semibold text-heading">— Sarah K., Verified Cook</p>
            </div>
            <div className="mt-2.5 flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-md border border-rose-100 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                <Heart className="size-3 fill-rose-500 text-rose-500" aria-hidden="true" />
                84 Saves
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary-soft px-2 py-0.5 font-semibold text-primary-strong">
                Community Favorite
              </span>
            </div>
          </div>
        </li>
      </ol>

      {/* Bottom Conversion Callout */}
      <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row items-center justify-between gap-5 rounded-2xl border border-border/80 bg-gradient-to-r from-primary-soft/50 via-card to-secondary-soft/40 p-6 sm:p-8 shadow-xs backdrop-blur-xs">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="inline-flex size-2 rounded-full bg-primary" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary-strong">
              Instant Generation · Zero Food Waste
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight text-heading">
            Ready to see what you can cook right now?
          </h3>
          <p className="text-sm text-subtle-foreground max-w-xl">
            Enter what is in your fridge or pantry, and let our culinary AI surprise you with delicious, customized recipes.
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col items-center gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/generator"
            className={`${buttonStyles({
              variant: "primary",
              size: "md",
            })} w-full gap-2 font-semibold shadow-xs hover:shadow-md sm:w-auto`}
          >
            <span>Try Recipe Generator</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href="/recipes"
            className={`${buttonStyles({
              variant: "outline",
              size: "md",
            })} w-full font-medium sm:w-auto`}
          >
            Browse Recipes
          </Link>
        </div>
      </div>
    </section>
  );
}

async function FeaturedRecipes() {
  const recipes = await getFeaturedRecipes();

  return (
    <section
      aria-labelledby="featured-heading"
      className={`${containerClass} border-t border-border py-16 sm:py-20`}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="featured-heading" className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
            From the community
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Discover recipes shared by other home cooks.
          </p>
        </div>
        <Link
          href="/recipes"
          className="hidden shrink-0 items-center gap-1.5 rounded-button text-sm font-medium text-primary-strong transition-colors hover:text-primary-deep focus-visible:text-primary-deep sm:inline-flex"
        >
          Browse all recipes
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      {recipes && recipes.length > 0 ? (
        <ul className="mt-8 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <RecipeCard recipe={recipe} className="h-full" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={<Star />}
            title="No published recipes yet"
            description="Fresh community recipes are on the way. Be the first to share one with the world."
            action={
              <Link href="/generator" className={buttonStyles()}>
                Generate the first one
              </Link>
            }
          />
        </div>
      )}
    </section>
  );
}

function CallToActionBand() {
  return (
    <section aria-labelledby="cta-heading" className={`${containerClass} pb-20 pt-4`}>
      <div className="rounded-card bg-primary-strong px-6 py-12 text-center sm:px-12 sm:py-16">
        <h2 id="cta-heading" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Ready to cook what you already have?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-white">
          Your next favorite meal is hiding in your kitchen.
        </p>
        <Link
          href="/generator"
          className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-button bg-card px-6 text-base font-semibold text-primary-strong transition-colors hover:bg-primary-soft focus-visible:bg-primary-soft"
        >
          Start generating
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <FeaturedRecipes />
      <CallToActionBand />
    </>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Check,
  Flame,
  Heart,
  Sliders,
  Sparkles,
  Star,
} from "@gravity-ui/icons";
import { buttonStyles } from "@/components/ui";
import { MotionProvider } from "@/components/home/motion-provider";
import { HeroFadeIn, HeroFloat } from "@/components/home/hero-motion";
import { Reveal } from "@/components/home/reveal";
import { AIToolsShowcase } from "@/components/home/ai-tools-showcase";
import { PantryQuickInput } from "@/components/home/pantry-quick-input";
import { IngredientMarquee } from "@/components/home/ingredient-marquee";
import { CommunitySection } from "@/components/home/community-section";
import { listRecipes } from "@/lib/api";
import type { Recipe } from "@/lib/types";

const containerClass = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

interface HomeData {
  totalCount: number;
  topRecipe: Recipe | null;
  featuredRecipes: Recipe[] | null;
}

/**
 * Fetches homepage data: recipe total count, top-rated recipe for Hero showcase,
 * and up to 3 newest published recipes. Gracefully returns fallbacks on API error.
 */
async function getHomeData(): Promise<HomeData> {
  try {
    const [countResult, topResult, featuredResult] = await Promise.all([
      listRecipes({ limit: 1 }),
      listRecipes({ sort: "highest-rated", limit: 1 }),
      listRecipes({ sort: "newest", limit: 3 }),
    ]);
    return {
      totalCount: countResult.total,
      topRecipe: topResult.items[0] ?? null,
      featuredRecipes: featuredResult.items,
    };
  } catch {
    return {
      totalCount: 0,
      topRecipe: null,
      featuredRecipes: null,
    };
  }
}

function Hero({ totalCount, topRecipe }: { totalCount: number; topRecipe: Recipe | null }) {
  const showcaseTitle = topRecipe?.title ?? "Artisan Kitchen Showcase";
  const showcaseImage = topRecipe?.imageUrl ?? "/images/spicy-meat.jpg";
  const showcaseCategory = topRecipe?.category ? topRecipe.category.replace("-", " ") : "Community Favorite";
  const showcaseTime = topRecipe?.totalTimeMinutes ? `${topRecipe.totalTimeMinutes} min` : "Quick & Easy";

  return (
    <MotionProvider>
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
              <HeroFadeIn delay={0}>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft/90 px-3.5 py-1.5 text-xs font-semibold text-primary-strong shadow-2xs backdrop-blur-xs">
                  <span className="flex size-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                  <span>AI Culinary Copilot</span>
                  <span className="text-border-strong" aria-hidden="true">
                    •
                  </span>
                  <span className="font-medium text-subtle-foreground">Zero Food Waste</span>
                </div>
              </HeroFadeIn>

              {/* Headline */}
              <HeroFadeIn delay={0.06}>
                <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-heading sm:text-5xl lg:text-[3.65rem] lg:leading-[1.12]">
                  Turn your ingredients into{" "}
                  <span className="bg-gradient-to-r from-primary via-amber-500 to-primary-strong bg-clip-text text-transparent">
                    delicious meals
                  </span>{" "}
                  <span className="inline-block transition-transform hover:scale-110 duration-200" aria-hidden="true">
                    <Flame className="inline size-8 text-primary align-middle" />
                  </span>
                </h1>
              </HeroFadeIn>

              {/* Subtitle */}
              <HeroFadeIn delay={0.12}>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-subtle-foreground sm:text-lg">
                  Tell FlavorAI what is resting in your kitchen or snap a photo of your plate.
                  Get instant, nutrition-aware recipes, cut down grocery waste, and unleash your inner chef in seconds.
                </p>
              </HeroFadeIn>

              {/* Action Buttons */}
              <HeroFadeIn delay={0.18}>
                <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                  <Link
                    href="/generator"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-button bg-primary px-6 text-base font-semibold text-white shadow-md shadow-primary/25 transition-all hover:bg-primary-strong hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    <Sparkles className="size-4.5" aria-hidden="true" />
                    <span>Generate a recipe</span>
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/nutrition-analyzer"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-button border border-border bg-card px-5 text-base font-semibold text-heading shadow-xs transition-all hover:border-primary/50 hover:bg-primary-soft/50 hover:text-primary-strong hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    <Camera className="size-4.5 text-primary" aria-hidden="true" />
                    <span>Scan photo nutrition</span>
                  </Link>
                </div>
              </HeroFadeIn>

              {/* Secondary Explore Link */}
              <HeroFadeIn delay={0.24}>
                <div className="mt-4">
                  <Link
                    href="/recipes"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary-strong"
                  >
                    <span>Browse {totalCount > 0 ? `${totalCount}` : "all"} community recipes</span>
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </HeroFadeIn>

              {/* Verified Static Feature Highlights */}
              <HeroFadeIn delay={0.30}>
                <div className="mt-10 grid w-full grid-cols-3 gap-2.5 border-t border-border pt-8 sm:gap-4">
                  <div className="flex flex-col rounded-card border border-border/80 bg-card/80 p-3 sm:p-3.5 shadow-2xs backdrop-blur-xs">
                    <div className="flex items-center gap-1.5 text-primary">
                      <Sparkles className="size-4 text-primary" aria-hidden="true" />
                      <span className="text-sm font-bold text-heading sm:text-base">4 AI Tools</span>
                    </div>
                    <span className="mt-1 text-xs text-muted-foreground">Smart culinary suite</span>
                  </div>

                  <div className="flex flex-col rounded-card border border-border/80 bg-card/80 p-3 sm:p-3.5 shadow-2xs backdrop-blur-xs">
                    <div className="flex items-center gap-1.5 text-secondary-strong">
                      <Check className="size-4 text-secondary-strong" aria-hidden="true" />
                      <span className="text-sm font-bold text-heading sm:text-base">Free to Use</span>
                    </div>
                    <span className="mt-1 text-xs text-muted-foreground">No subscription required</span>
                  </div>

                  <div className="flex flex-col rounded-card border border-border/80 bg-card/80 p-3 sm:p-3.5 shadow-2xs backdrop-blur-xs">
                    <div className="flex items-center gap-1.5 text-amber-500">
                      <Sparkles className="size-4 text-amber-500" aria-hidden="true" />
                      <span className="text-sm font-bold text-heading sm:text-base">Zero Waste</span>
                    </div>
                    <span className="mt-1 text-xs text-muted-foreground">Cook with pantry items</span>
                  </div>
                </div>
              </HeroFadeIn>
            </div>

            {/* Right Column: Culinary Presentation & Real Top Recipe Showcase */}
            <div className="relative flex justify-center lg:col-span-5 lg:justify-end">
              {/* Ambient visual glow behind hero image */}
              <div
                aria-hidden="true"
                className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-primary/20 via-amber-400/20 to-secondary/15 blur-2xl -z-10"
              />

              {/* Main Showcase Container */}
              <HeroFloat delay={0}>
                <div className="relative w-full max-w-md sm:max-w-lg lg:max-w-none">
                  <div className="group relative overflow-hidden rounded-[2rem] border border-white/80 bg-card shadow-2xl transition-transform duration-500 hover:scale-[1.01]">
                    {showcaseImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={showcaseImage}
                        alt={showcaseTitle}
                        className="aspect-square w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-primary-soft via-amber-100/50 to-secondary-soft">
                        <Sparkles className="size-16 text-primary/40" aria-hidden="true" />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-80" />

                    {/* Dish Caption Overlay */}
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white drop-shadow-md">
                      <div className="max-w-[70%]">
                        <p className="truncate text-sm font-bold">{showcaseTitle}</p>
                        <p className="text-xs text-white/90 capitalize">{showcaseCategory}</p>
                      </div>
                      <span className="rounded-full bg-white/25 px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
                        {showcaseTime}
                      </span>
                    </div>
                  </div>

                  {/* Real Top Rating Badge (if top recipe exists) */}
                  {topRecipe && (
                    <HeroFloat delay={0.3}>
                      <div className="absolute -left-3 -top-5 sm:-left-6 sm:-top-6 rounded-card border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md transition-transform hover:-translate-y-1">
                        <div className="flex items-center gap-1.5 text-amber-500">
                          <Star className="size-4 fill-amber-500" aria-hidden="true" />
                          <span className="text-xs font-bold text-heading">
                            {topRecipe.averageRating > 0 ? topRecipe.averageRating.toFixed(1) : "Top Rated"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            ({topRecipe.ratingCount} {topRecipe.ratingCount === 1 ? "rating" : "ratings"})
                          </span>
                        </div>
                      </div>
                    </HeroFloat>
                  )}
                </div>
              </HeroFloat>
            </div>
          </div>
        </div>
      </section>
    </MotionProvider>
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
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3.5 py-1 text-xs font-bold text-primary-strong shadow-2xs">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            Three-Step Culinary Workflow
          </span>
        </Reveal>
        <Reveal delay={0.06}>
          <h2
            id="how-it-works-heading"
            className="mt-4 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl"
          >
            From pantry to plate in{" "}
            <span className="bg-gradient-to-r from-primary via-amber-600 to-primary-strong bg-clip-text text-transparent">
              three effortless steps
            </span>
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-3 text-base sm:text-lg leading-relaxed text-subtle-foreground">
            FlavorAI starts with what you already have, not an expensive grocery run. Eliminate food waste and whip up restaurant-quality dishes in minutes.
          </p>
        </Reveal>
      </div>

      {/* 3 Step Cards Grid */}
      <ol className="mt-12 grid list-none gap-6 sm:gap-8 lg:grid-cols-3">
        {/* Step 1 */}
        <Reveal delay={0} className="flex flex-col">
          <li className="group relative flex flex-1 flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl">
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

            {/* Micro-UI: Pantry items & filters with explicit Example badge */}
            <div className="mt-6 rounded-xl border border-border/80 bg-background/80 p-3.5 shadow-2xs backdrop-blur-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-heading">
                  <span className="size-2 rounded-full bg-primary animate-pulse" aria-hidden="true" />
                  Available Ingredients
                </span>
                <span className="rounded-full bg-border/60 px-2 py-0.5 text-[10px] font-medium text-subtle-foreground">
                  Example
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
                  🧄 Garlic
                </span>
              </div>
            </div>
          </li>
        </Reveal>

        {/* Step 2 */}
        <Reveal delay={0.08} className="flex flex-col">
          <li className="group relative flex flex-1 flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-amber-400 hover:shadow-xl">
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
                AI balances flavor pairings, generates ordered steps, estimates macronutrients, and highlights optional pantry additions.
              </p>
            </div>

            {/* Micro-UI: Generated Recipe Match with explicit Example badge */}
            <div className="mt-6 rounded-xl border border-border/80 bg-background/80 p-3.5 shadow-2xs backdrop-blur-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-heading">
                  <Sparkles className="size-3.5 text-amber-500" aria-hidden="true" />
                  AI Recipe Output
                </span>
                <span className="rounded-full bg-border/60 px-2 py-0.5 text-[10px] font-medium text-subtle-foreground">
                  Example
                </span>
              </div>
              <div className="mt-2.5 rounded-lg border border-border/70 bg-card p-2.5 shadow-2xs">
                <p className="truncate text-xs font-bold text-heading">Garlic-Herb Grilled Chicken</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Detailed steps &amp; estimated nutrition</p>
              </div>
            </div>
          </li>
        </Reveal>

        {/* Step 3 */}
        <Reveal delay={0.16} className="flex flex-col">
          <li className="group relative flex flex-1 flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-6 sm:p-7 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-secondary/40 hover:shadow-xl">
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
                Save recipes to your private cookbook, publish them to the community, and collect ratings and helpful cooking tips.
              </p>
            </div>

            {/* Micro-UI: Social proof & community features */}
            <div className="mt-6 rounded-xl border border-border/80 bg-background/80 p-3.5 shadow-2xs backdrop-blur-xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-heading">Community Cookbooks</span>
                <span className="rounded-full bg-border/60 px-2 py-0.5 text-[10px] font-medium text-subtle-foreground">
                  Example
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-md border border-rose-100 bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                  <Heart className="size-3 fill-rose-500 text-rose-500" aria-hidden="true" />
                  Favorites
                </span>
                <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary-soft px-2 py-0.5 font-semibold text-primary-strong">
                  Ratings &amp; Reviews
                </span>
              </div>
            </div>
          </li>
        </Reveal>
      </ol>

      {/* Bottom Conversion Callout */}
      <Reveal delay={0.24}>
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
              })} w-full gap-2 font-semibold shadow-xs hover:shadow-md sm:w-auto active:scale-[0.98]`}
            >
              <span>Try Recipe Generator</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/recipes"
              className={`${buttonStyles({
                variant: "outline",
                size: "md",
              })} w-full font-medium sm:w-auto active:scale-[0.98]`}
            >
              Browse Recipes
            </Link>
          </div>
        </div>
      </Reveal>
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
          className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-button bg-card px-6 text-base font-semibold text-primary-strong transition-colors hover:bg-primary-soft focus-visible:bg-primary-soft active:scale-[0.98]"
        >
          Start generating
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const { totalCount, topRecipe, featuredRecipes } = await getHomeData();

  return (
    <>
      <Hero totalCount={totalCount} topRecipe={topRecipe} />
      <PantryQuickInput />
      <IngredientMarquee />
      <AIToolsShowcase />
      <HowItWorks />
      <CommunitySection initialRecipes={featuredRecipes} />
      <CallToActionBand />
    </>
  );
}


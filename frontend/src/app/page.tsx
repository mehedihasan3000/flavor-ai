import Link from "next/link";
import { ArrowRight, Flame, Star } from "@gravity-ui/icons";
import { Badge, buttonStyles, Card, EmptyState } from "@/components/ui";

const containerClass = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

const HERO_INGREDIENTS = ["chicken breast", "garlic", "olive oil", "spinach"] as const;

const STEPS = [
  {
    title: "Share your pantry",
    description:
      "Add the ingredients you already have, plus your diet, allergies, cooking time, and skill level.",
  },
  {
    title: "Get a personalized recipe",
    description:
      "AI drafts a complete recipe with ordered steps, nutrition estimates, and any missing ingredients you may need.",
  },
  {
    title: "Cook, rate, and share",
    description:
      "Save it privately, publish it to the community, and collect ratings, comments, and favorites.",
  },
] as const;

function Hero() {
  return (
    <section className={`${containerClass} pb-16 pt-12 sm:pb-20 sm:pt-20`}>
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <Badge variant="primary">AI-powered recipe generator</Badge>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-heading sm:text-5xl">
          Turn your ingredients into delicious possibilities
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Tell FlavorAI what is already in your kitchen. Get personalized, nutrition-aware
          recipes in seconds — reduce food waste, skip extra grocery runs, and share what
          you create.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/generator" className={buttonStyles({ size: "lg" })}>
            Generate a recipe
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link
            href="/recipes"
            className={buttonStyles({ variant: "outline", size: "lg" })}
          >
            Browse community recipes
          </Link>
        </div>
      </div>

      <div aria-hidden="true" className="mx-auto mt-14 max-w-xl">
        <Card className="p-6 sm:p-8">
          <ul className="flex flex-wrap justify-center gap-2">
            {HERO_INGREDIENTS.map((ingredient) => (
              <li key={ingredient}>
                <Badge variant="outline">{ingredient}</Badge>
              </li>
            ))}
          </ul>
          <div className="my-5 flex items-center gap-3 text-primary">
            <span className="h-px flex-1 bg-border" />
            <Flame className="size-4" />
            <span className="h-px flex-1 bg-border" />
          </div>
          <p className="text-center text-sm font-semibold text-heading">
            Garlic spinach chicken
          </p>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            30 min · Serves 2 · Easy
          </p>
        </Card>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className={`${containerClass} border-t border-border py-16 sm:py-20`}
    >
      <div className="max-w-2xl">
        <h2 id="how-it-works-heading" className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
          From pantry to plate in three steps
        </h2>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          FlavorAI starts with what you have, not a shopping list.
        </p>
      </div>

      <ol className="mt-10 grid list-none gap-10 sm:grid-cols-3 sm:gap-6">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex flex-col items-start">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-strong">
              {index + 1}
            </span>
            <h3 className="mt-4 text-base font-semibold text-heading">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FeaturedRecipes() {
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

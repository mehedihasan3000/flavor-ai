import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  Flame,
  ShoppingBasket,
  Sparkles,
} from "@gravity-ui/icons";
import { Badge, buttonStyles } from "@/components/ui";

export interface HowItWorksStep {
  number: string;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof ShoppingBasket;
  tag: string;
  points: string[];
}

const STEPS: HowItWorksStep[] = [
  {
    number: "01",
    title: "Input Pantry",
    subtitle: "List what is in your kitchen",
    description:
      "Tell FlavorAI what ingredients you have on hand, your dietary restrictions, allergies, and available cooking time.",
    icon: ShoppingBasket,
    tag: "Zero Waste",
    points: [
      "Add fresh produce & pantry staples",
      "Set diet filters (Keto, Vegan, GF)",
      "Specify max prep time & skill level",
    ],
  },
  {
    number: "02",
    title: "AI Generation",
    subtitle: "Instant structured culinary intelligence",
    description:
      "Our ultra-fast Groq-powered engine synthesizes custom recipes with exact measurements and step-by-step guidance.",
    icon: Sparkles,
    tag: "Groq LPU Speed",
    points: [
      "Sub-2s response with GPT & Qwen models",
      "Strict Zod schema validation",
      "Clear used vs. missing ingredient breakdown",
    ],
  },
  {
    number: "03",
    title: "Cook & Share",
    subtitle: "Prepare, review, and inspire others",
    description:
      "Follow curated instructions, tweak serving sizes, save to your cookbook, and share your creations with the community.",
    icon: Flame,
    tag: "Community Driven",
    points: [
      "Step-by-step interactive cooking view",
      "One-click recipe publishing & forks",
      "Real community ratings & reviews",
    ],
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-3xl text-center">
        <Badge variant="primary">Simple 3-Step Process</Badge>
        <h2
          id="how-it-works-heading"
          className="mt-4 text-3xl font-bold tracking-tight text-heading sm:text-4xl"
        >
          How FlavorAI Turns Ingredients into Meals
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          No more guessing what to make or letting groceries spoil. Go from a handful of ingredients to a delicious, verified recipe in seconds.
        </p>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="group relative flex flex-col justify-between rounded-card border border-border bg-card p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md sm:p-8"
            >
              <div>
                {/* Step header: Number badge and Icon */}
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-base font-bold text-primary-strong">
                    {step.number}
                  </span>
                  <div className="flex size-11 items-center justify-center rounded-xl bg-background text-primary transition-colors group-hover:bg-primary-soft">
                    <Icon className="size-6" />
                  </div>
                </div>

                {/* Tag */}
                <div className="mt-5">
                  <Badge variant={idx === 0 ? "secondary" : idx === 1 ? "primary" : "warning"}>
                    {step.tag}
                  </Badge>
                </div>

                {/* Titles */}
                <h3 className="mt-3 text-xl font-bold text-heading">
                  {step.title}
                </h3>
                <p className="text-xs font-medium text-primary-strong">
                  {step.subtitle}
                </p>

                {/* Description */}
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>

                {/* Points checklist */}
                <ul className="mt-5 space-y-2 border-t border-border pt-4 text-xs text-subtle-foreground">
                  {step.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2">
                      <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-secondary-strong" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Step indicator footer */}
              <div className="mt-6 flex items-center gap-2 pt-2 text-xs font-semibold text-muted-foreground">
                <span>Step {idx + 1} of 3</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 flex justify-center">
        <Link href="/generator" className={buttonStyles({ size: "lg" })}>
          Try the Generator Now
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </section>
  );
}

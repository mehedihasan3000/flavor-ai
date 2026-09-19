"use client";

import Link from "next/link";
import { ArrowRight, Camera, Sliders, Sparkles, Target } from "@gravity-ui/icons";
import { Reveal } from "./reveal";

const containerClass = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

interface AIToolItem {
  id: string;
  title: string;
  description: string;
  href: string;
  badge: string;
  icon: typeof Sparkles;
  gradient: string;
}

const AI_TOOLS: ReadonlyArray<AIToolItem> = [
  {
    id: "generator",
    title: "Recipe Generator",
    description: "Transform your current pantry ingredients into tailored recipes in seconds.",
    href: "/generator",
    badge: "Pantry AI",
    icon: Sparkles,
    gradient: "from-amber-500/10 via-primary/5 to-transparent",
  },
  {
    id: "assistant",
    title: "Kitchen Assistant",
    description: "Interactive AI copilot for meal ideas, flavor swaps, and cooking advice.",
    href: "/assistant",
    badge: "Copilot",
    icon: Target,
    gradient: "from-primary/10 via-amber-500/5 to-transparent",
  },
  {
    id: "photo-analyzer",
    title: "Photo Nutrition",
    description: "Snap or upload a meal photo for instant macronutrient and ingredient breakdown.",
    href: "/nutrition-analyzer",
    badge: "Vision AI",
    icon: Camera,
    gradient: "from-secondary/10 via-emerald-500/5 to-transparent",
  },
  {
    id: "diet-plan",
    title: "Diet Plan",
    description: "Calculate personalized BMR, daily macro targets, and structured meal guidelines.",
    href: "/diet-plan",
    badge: "Planner",
    icon: Sliders,
    gradient: "from-primary-soft via-amber-100/30 to-transparent",
  },
];

export function AIToolsShowcase() {
  return (
    <section aria-labelledby="ai-tools-heading" className={`${containerClass} py-16 sm:py-24`}>
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3.5 py-1 text-xs font-bold text-primary-strong shadow-2xs">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            Complete AI Culinary Suite
          </span>
        </Reveal>
        <Reveal delay={0.06}>
          <h2 id="ai-tools-heading" className="mt-4 text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
            Everything you need for{" "}
            <span className="bg-gradient-to-r from-primary via-amber-600 to-primary-strong bg-clip-text text-transparent">
              smarter home cooking
            </span>
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-3 text-base sm:text-lg leading-relaxed text-subtle-foreground">
            Four specialized AI tools working together to save time, eliminate waste, and optimize your nutrition.
          </p>
        </Reveal>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {AI_TOOLS.map((tool, index) => {
          const ToolIcon = tool.icon;
          return (
            <Reveal key={tool.id} delay={index * 0.08} className="flex">
              <Link
                href={tool.href}
                className="group relative flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${tool.gradient} opacity-50 transition-opacity group-hover:opacity-100`} aria-hidden="true" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary-soft text-primary-strong shadow-2xs transition-transform duration-300 group-hover:scale-110">
                      <ToolIcon className="size-5.5" aria-hidden="true" />
                    </span>
                    <span className="rounded-full bg-border/60 px-2.5 py-0.5 text-[10px] font-semibold text-subtle-foreground">
                      {tool.badge}
                    </span>
                  </div>

                  <h3 className="mt-5 text-lg font-bold tracking-tight text-heading transition-colors group-hover:text-primary-strong">
                    {tool.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-subtle-foreground">
                    {tool.description}
                  </p>
                </div>

                <div className="relative z-10 mt-6 flex items-center gap-1 text-xs font-bold text-primary transition-all group-hover:translate-x-1 group-hover:text-primary-strong">
                  <span>Try it</span>
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

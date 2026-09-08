import {
  Check,
  Cpu,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrashBin,
} from "@gravity-ui/icons";
import { Badge } from "@/components/ui";

export interface HighlightItem {
  id: string;
  badge: string;
  badgeVariant: "primary" | "secondary" | "warning";
  title: string;
  tagline: string;
  description: string;
  icon: typeof TrashBin;
  statNumber: string;
  statLabel: string;
  bulletPoints: string[];
  techPill: string;
}

const HIGHLIGHTS: HighlightItem[] = [
  {
    id: "zero-waste",
    badge: "Smart Sustainability",
    badgeVariant: "secondary",
    title: "Zero Waste Intelligence",
    tagline: "Prioritizes pantry ingredients nearing expiry",
    description:
      "Our AI pairs what you already have in your fridge and pantry first, minimizing food waste and saving on unnecessary grocery runs.",
    icon: TrashBin,
    statNumber: "85%+",
    statLabel: "Average pantry utilization",
    bulletPoints: [
      "Smart pantry-first ingredient matching",
      "Explicit separation of used vs. missing items",
      "Calculated pantry utilization score",
    ],
    techPill: "FR-AI-01 Pantry Matching",
  },
  {
    id: "zod-validation",
    badge: "Reliable & Safe",
    badgeVariant: "primary",
    title: "Strict Zod Schema Validation",
    tagline: "100% type-safe, allergen-checked output",
    description:
      "Every LLM generation passes through strict server-side Zod validation pipelines. No hallucinated instructions, broken steps, or unverified output.",
    icon: ShieldCheck,
    statNumber: "100%",
    statLabel: "Schema validation guarantee",
    bulletPoints: [
      "Strict JSON recipe contract compliance",
      "Structured nutritional & allergen verification",
      "Automatic fallback & retry handling",
    ],
    techPill: "FR-AI-07 Contract Enforcement",
  },
  {
    id: "groq-adapter",
    badge: "Sub-Second Inference",
    badgeVariant: "warning",
    title: "Fast Groq LPU Adapter",
    tagline: "Blazing fast generation with top OSS models",
    description:
      "Powered by Groq's low-latency LPU inference engine, running GPT-OSS 120B and Qwen 3.6 27B models to deliver complete recipes in seconds.",
    icon: Rocket,
    statNumber: "< 2s",
    statLabel: "Average recipe generation time",
    bulletPoints: [
      "Ultra-fast parallel token generation",
      "Dynamic failover across model providers",
      "Strict ≤30s timeout with safe error states",
    ],
    techPill: "Groq LPU Engine",
  },
];

export function AiHighlights() {
  return (
    <section
      aria-labelledby="ai-highlights-heading"
      className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      {/* Section Header */}
      <div className="mx-auto max-w-3xl text-center">
        <Badge variant="primary" className="gap-1.5">
          <Sparkles className="size-3.5" />
          FlavorAI Engine Superpowers
        </Badge>
        <h2
          id="ai-highlights-heading"
          className="mt-4 text-3xl font-bold tracking-tight text-heading sm:text-4xl"
        >
          Engineered for Speed, Safety, and Zero Food Waste
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          Unlike generic chatbot recipes, FlavorAI is purpose-built with strict data structures, certified pantry matching, and hardware-accelerated inference.
        </p>
      </div>

      {/* 3 Highlight Cards */}
      <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {HIGHLIGHTS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-card border border-border bg-card p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md sm:p-8"
            >
              <div>
                {/* Header with icon & badge */}
                <div className="flex items-center justify-between">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong">
                    <Icon className="size-6" />
                  </div>
                  <Badge variant={item.badgeVariant}>{item.badge}</Badge>
                </div>

                {/* Title and tagline */}
                <h3 className="mt-6 text-xl font-bold text-heading">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs font-semibold text-primary-strong">
                  {item.tagline}
                </p>

                {/* Description */}
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>

                {/* Stat Box */}
                <div className="mt-6 rounded-xl bg-background p-4 text-center">
                  <span className="text-3xl font-extrabold tracking-tight text-heading">
                    {item.statNumber}
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.statLabel}
                  </p>
                </div>

                {/* Checklist */}
                <ul className="mt-6 space-y-2.5 text-xs text-subtle-foreground">
                  {item.bulletPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <div className="mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-secondary-strong">
                        <Check className="size-2.5" />
                      </div>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tech Spec Pill */}
              <div className="mt-8 border-t border-border pt-4">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-muted-foreground">
                  <Cpu className="size-3.5" />
                  {item.techPill}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

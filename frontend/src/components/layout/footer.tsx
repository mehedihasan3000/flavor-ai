import Link from "next/link";
import { Flame } from "@gravity-ui/icons";

const EXPLORE_LINKS = [
  { href: "/generator", label: "Recipe Generator" },
  { href: "/recipes", label: "Discover Recipes" },
  { href: "/favorites", label: "Favorites" },
] as const;

const ACCOUNT_LINKS = [
  { href: "/sign-in", label: "Sign in" },
  { href: "/profile", label: "Profile & Preferences" },
] as const;

function FooterColumn({
  label,
  links,
}: {
  label: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <nav aria-label={label}>
      <h2 className="text-sm font-semibold text-heading">{label}</h2>
      <ul className="mt-3 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline hover:underline-offset-4"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
          <div className="max-w-sm space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-button bg-primary-soft text-primary-strong">
                <Flame className="size-5" aria-hidden="true" />
              </span>
              <span className="text-lg font-bold tracking-tight text-heading">FlavorAI</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Turn the ingredients you already have into personalized, nutrition-aware
              recipes, then share them with a community of home cooks.
            </p>
          </div>

          <FooterColumn label="Explore" links={EXPLORE_LINKS} />
          <FooterColumn label="Account" links={ACCOUNT_LINKS} />
        </div>

        <div className="mt-10 space-y-3 border-t border-border pt-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Recipes on FlavorAI may be generated with AI and can contain errors. Nutrition
            values are estimates, not medical advice. If you have food allergies or dietary
            restrictions, always verify every ingredient independently before cooking.
          </p>
          <p className="text-xs text-muted-foreground">
            © {year} FlavorAI. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

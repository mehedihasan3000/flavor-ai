"use client";

import Link from "next/link";
import { Lock, Person } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth-context";
import { Button, Card } from "@/components/ui";

export interface AuthPromptProps {
  /** The action the user attempted (e.g. "favorite this recipe", "leave a review", "generate AI recipes") */
  actionName?: string;
  /** Custom description */
  description?: string;
  /** Inline vs Card display */
  variant?: "card" | "banner";
  /** Callback URL to return after sign in */
  callbackUrl?: string;
  /** Class name */
  className?: string;
}

/**
 * Friendly prompt displayed when guests attempt actions that require authentication
 * (FR-AUTH-03: favorite, rate, comment, save/publish).
 */
export function AuthPrompt({
  actionName = "perform this action",
  description,
  variant = "card",
  callbackUrl,
  className = "",
}: AuthPromptProps) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return null;
  }

  const redirectParam = callbackUrl
    ? `?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "";

  if (variant === "banner") {
    return (
      <div
        className={`flex flex-col items-center justify-between gap-3 rounded-card border border-primary/20 bg-primary-soft/50 p-4 text-left sm:flex-row ${className}`}
        role="region"
        aria-label="Authentication required"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-button bg-primary-soft text-primary-strong">
            <Lock className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-heading">
              Sign in to {actionName}
            </p>
            <p className="text-xs text-muted-foreground">
              {description ||
                "Join our community to save recipes, write reviews, and customize preferences."}
            </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
          <Link href={`/sign-in${redirectParam}`} className="w-full sm:w-auto">
            <Button size="sm" className="w-full sm:w-auto">
              Sign in
            </Button>
          </Link>
          <Link href={`/sign-up${redirectParam}`} className="w-full sm:w-auto">
            <Button size="sm" variant="outline" className="w-full sm:w-auto">
              Sign up
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Card className={`p-6 text-center ${className}`}>
      <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong">
        <Person className="size-5" aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-base font-bold tracking-tight text-heading">
        Sign in to {actionName}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {description ||
          "Create a free account or sign in to rate recipes, post comments, manage your pantry, and save favorites."}
      </p>
      <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
        <Link href={`/sign-in${redirectParam}`}>
          <Button size="sm" className="w-full sm:w-auto">
            Sign in
          </Button>
        </Link>
        <Link href={`/sign-up${redirectParam}`}>
          <Button size="sm" variant="outline" className="w-full sm:w-auto">
            Create account
          </Button>
        </Link>
      </div>
    </Card>
  );
}

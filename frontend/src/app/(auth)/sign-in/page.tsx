"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeSlash, Flame, Lock, Person } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth-context";
import { Alert, Button, Card, Input } from "@/components/ui";
import { GoogleSignInButton } from "@/components/auth";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_denied: "Google sign-in was cancelled.",
  google_failed: "We couldn't complete Google sign-in. Please try again.",
  google_state_mismatch: "That Google sign-in link expired. Please try again.",
  google_email_unverified: "Your Google account's email isn't verified yet.",
  google_unconfigured: "Google sign-in isn't available right now.",
};

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/profile";
  const googleError = searchParams.get("error");

  const { signIn, isAuthenticated } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect
  if (isAuthenticated && !loading) {
    router.push(callbackUrl);
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      await signIn(cleanEmail, password);
      router.push(callbackUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSignIn = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    setLoading(true);
    try {
      await signIn(demoEmail, demoPass);
      router.push(callbackUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6 lg:py-16">
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong shadow-sm transition-transform hover:scale-105"
          aria-label="FlavorAI Home"
        >
          <Flame className="size-7" aria-hidden="true" />
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-heading sm:text-3xl">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to generate personalized recipes, manage your pantry, and access saved favorites.
        </p>
      </div>

      <Card className="mt-8 p-6 sm:p-8">
        {googleError && !error ? (
          <Alert variant="danger" className="mb-4">
            {GOOGLE_ERROR_MESSAGES[googleError] || GOOGLE_ERROR_MESSAGES.google_failed}
          </Alert>
        ) : null}

        <GoogleSignInButton callbackUrl={callbackUrl} />

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground font-medium">
              Or sign in with email
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? <Alert variant="danger">{error}</Alert> : null}

          <Input
            label="Email address"
            type="email"
            required
            autoComplete="email"
            placeholder="chef@flavorai.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <div className="space-y-1">
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8.5 text-muted-foreground transition-colors hover:text-heading"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeSlash className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" loading={loading} className="w-full mt-2">
            <Lock className="size-4" aria-hidden="true" />
            Sign in
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground font-medium">
              Demo accounts
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleQuickSignIn("chef@flavorai.com", "password123")}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-button border border-border bg-background/50 px-3 py-2 text-xs font-medium text-subtle-foreground transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-strong disabled:opacity-50"
          >
            <Person className="size-3.5" aria-hidden="true" />
            Demo User
          </button>
          <button
            type="button"
            onClick={() => handleQuickSignIn("admin@flavorai.com", "admin123456")}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-button border border-border bg-background/50 px-3 py-2 text-xs font-medium text-subtle-foreground transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-strong disabled:opacity-50"
          >
            <Lock className="size-3.5" aria-hidden="true" />
            Demo Admin
          </button>
        </div>
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account yet?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-primary-strong hover:text-primary-deep transition-colors inline-flex items-center gap-1"
        >
          Sign up for free
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-muted-foreground">Loading sign in…</div>}>
      <SignInContent />
    </Suspense>
  );
}

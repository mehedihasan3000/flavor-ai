"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeSlash, Flame, Person } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth-context";
import { getSafeCallbackUrl } from "@/lib/auth-utils";
import { Alert, Button, Card, Input } from "@/components/ui";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));

  const { signUp, isAuthenticated, isLoading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect (in an effect — never during render,
  // otherwise React throws "Cannot update a component (Router) while
  // rendering a different component")
  useEffect(() => {
    if (isAuthenticated && !loading) {
      router.push(callbackUrl);
    }
  }, [isAuthenticated, loading, router, callbackUrl]);

  // Prevent flash of unauthenticated content (FOUC) while session hydrates or during redirect
  if (isLoading || (isAuthenticated && !loading)) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-24 text-center">
        <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong shadow-sm animate-pulse">
          <Flame className="size-7" aria-hidden="true" />
        </div>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          Checking session…
        </p>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setError("Please enter your name.");
      return;
    }

    if (cleanName.length > 100) {
      setError("Name must be less than 100 characters.");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await signUp(cleanName, cleanEmail, password);
      router.push(callbackUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const signInHref =
    callbackUrl && callbackUrl !== "/profile"
      ? `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/sign-in";

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
          Create your account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Join FlavorAI to unlock smart pantry recipe generation, tailored food preferences, and community ratings.
        </p>
      </div>

      <Card className="mt-8 p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? <Alert variant="danger">{error}</Alert> : null}

          <Input
            label="Full name"
            type="text"
            required
            autoComplete="name"
            placeholder="Chef Julia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />

          <Input
            label="Email address"
            type="email"
            required
            autoComplete="email"
            placeholder="julia@example.com"
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
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="pr-10"
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

          <div className="space-y-1">
            <div className="relative">
              <Input
                label="Confirm password"
                type={showConfirmPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Re-type your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-8.5 text-muted-foreground transition-colors hover:text-heading"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <EyeSlash className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <Button type="submit" loading={loading} className="w-full mt-2">
            <Person className="size-4" aria-hidden="true" />
            Create account
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground font-medium">Or continue with</span>
          </div>
        </div>

        <GoogleSignInButton text="signup_with" redirectTo={callbackUrl} disabled={loading} onError={setError} />
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={signInHref}
          className="font-medium text-primary-strong hover:text-primary-deep transition-colors inline-flex items-center gap-1"
        >
          Sign in
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-muted-foreground">Loading sign up…</div>}>
      <SignUpContent />
    </Suspense>
  );
}

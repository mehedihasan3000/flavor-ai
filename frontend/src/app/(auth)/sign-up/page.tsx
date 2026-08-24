"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeSlash, Flame, Person } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth-context";
import { Alert, Button, Card, Input } from "@/components/ui";

function SignUpContent() {
  const router = useRouter();
  const { signUp, isAuthenticated } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && !loading) {
    router.push("/profile");
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
      router.push("/profile");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create account. Please try again.");
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

          <Input
            label="Confirm password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            placeholder="Re-type your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />

          <Button type="submit" loading={loading} className="w-full mt-2">
            <Person className="size-4" aria-hidden="true" />
            Create account
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/sign-in"
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

"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Lock, ShieldExclamation } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, LoadingState } from "@/components/ui";
import Link from "next/link";
import type { UserRole } from "@/lib/types";

export interface AuthGuardProps {
  children: ReactNode;
  /** Required role (e.g. "admin" for admin-only pages). Defaults to any authenticated user. */
  requiredRole?: UserRole;
  /** Custom fallback while loading or when unauthorized. */
  fallback?: ReactNode;
  /** Mode: "redirect" (default) or "render-fallback" */
  mode?: "redirect" | "render-fallback";
  /** Custom redirect path. Defaults to /sign-in?callbackUrl=<currentPath> */
  redirectTo?: string;
  /** Descriptive message of what requires authentication. */
  message?: string;
}

/**
 * Client-side route & content protection guard (FR-AUTH-03).
 * Renders loading state while auth context hydrates from storage/API,
 * then checks authentication and role permissions.
 */
export function AuthGuard({
  children,
  requiredRole,
  fallback,
  mode = "redirect",
  redirectTo,
  message,
}: AuthGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAuthorized =
    isAuthenticated && (!requiredRole || user?.role === requiredRole);

  const targetRedirect =
    redirectTo ||
    `/sign-in?callbackUrl=${encodeURIComponent(pathname || "/profile")}`;

  useEffect(() => {
    if (!isLoading && !isAuthorized && mode === "redirect") {
      router.push(targetRedirect);
    }
  }, [isLoading, isAuthorized, mode, targetRedirect, router]);

  // Loading skeleton while verifying token
  if (isLoading) {
    return (
      fallback ?? (
        <div className="flex min-h-[40vh] items-center justify-center p-8">
          <LoadingState label="Checking authentication…" />
        </div>
      )
    );
  }

  // Not authenticated or wrong role
  if (!isAuthorized) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (isAuthenticated && requiredRole && user?.role !== requiredRole) {
      // Role forbidden (e.g. user trying to access admin route)
      return (
        <div className="mx-auto max-w-lg p-6 py-12 text-center">
          <Card className="p-8">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-danger-bg text-danger-strong">
              <ShieldExclamation className="size-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-heading">
              Access Restricted
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You do not have the required permissions ({requiredRole}) to view
              this page.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="outline" onClick={() => router.back()}>
                Go back
              </Button>
              <Link href="/">
                <Button>Home</Button>
              </Link>
            </div>
          </Card>
        </div>
      );
    }

    // Unauthenticated fallback view (for render-fallback mode or pending redirect)
    return (
      <div className="mx-auto max-w-md p-6 py-12 text-center">
        <Card className="p-8">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong">
            <Lock className="size-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-xl font-bold tracking-tight text-heading">
            Sign In Required
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {message ||
              "Please sign in to access this page and manage your personalized recipes."}
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link href={targetRedirect} className="w-full">
              <Button className="w-full">Sign in</Button>
            </Link>
            <Link href="/sign-up" className="w-full">
              <Button variant="outline" className="w-full">
                Create free account
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

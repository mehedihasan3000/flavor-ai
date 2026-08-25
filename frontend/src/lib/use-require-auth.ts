"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./auth-context";

export interface RequireAuthOptions {
  /** Target callback URL to return after sign in. Defaults to current pathname. */
  callbackUrl?: string;
  /** Whether to automatically redirect to /sign-in if unauthenticated. Default: true */
  redirect?: boolean;
}

/**
 * Hook to guard client-side actions and interactive controls (FR-AUTH-03).
 *
 * Example:
 * ```tsx
 * const { requireAuth, isAuthenticated } = useRequireAuth();
 *
 * const handleFavorite = () => {
 *   requireAuth(async () => {
 *     await toggleFavorite(recipeId);
 *   });
 * };
 * ```
 */
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const requireAuth = useCallback(
    <T>(
      action: () => T | Promise<T>,
      options: RequireAuthOptions = {},
    ): Promise<T | null> => {
      const { callbackUrl, redirect = true } = options;

      if (!auth.isAuthenticated) {
        if (redirect) {
          const target = callbackUrl || pathname || "/";
          router.push(`/sign-in?callbackUrl=${encodeURIComponent(target)}`);
        }
        return Promise.resolve(null);
      }

      return Promise.resolve(action());
    },
    [auth.isAuthenticated, pathname, router],
  );

  return {
    ...auth,
    requireAuth,
  };
}

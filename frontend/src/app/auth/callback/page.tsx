"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LoadingState } from "@/components/ui";

/**
 * Bridge page for the Google OAuth redirect. `/api/auth/google/callback`
 * lands here with `#token=...&callbackUrl=...` in the URL fragment (never
 * sent to any server, unlike a query string) — we read it client-side,
 * hand it to the same auth-context session logic sign-in/sign-up already
 * use, then continue on to the original destination.
 */
export default function GoogleCallbackPage() {
  const router = useRouter();
  const { signInWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(hash);
    const token = params.get("token");
    const callbackUrl = params.get("callbackUrl") || "/profile";

    // Strip the token out of the address bar immediately.
    window.history.replaceState(null, "", window.location.pathname);

    if (!token) {
      router.replace("/sign-in?error=google_failed");
      return;
    }

    signInWithToken(token)
      .then(() => {
        router.replace(callbackUrl);
      })
      .catch(() => {
        setError("We couldn't complete Google sign-in. Redirecting you back…");
        setTimeout(() => router.replace("/sign-in?error=google_failed"), 1500);
      });
  }, [router, signInWithToken]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <LoadingState label={error ?? "Finishing Google sign-in…"} />
    </div>
  );
}

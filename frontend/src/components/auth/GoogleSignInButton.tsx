"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSafeCallbackUrl } from "@/lib/auth-utils";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: string;
              size?: string;
              width?: number | string;
              text?: string;
              shape?: string;
              logo_alignment?: string;
            },
          ) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  /** Google button text variant — maps to GIS `text` param */
  text?: "signin_with" | "signup_with" | "continue_with";
  /** Where to redirect after success. Defaults to callbackUrl search param or /profile */
  redirectTo?: string;
  /** Disable the button externally (e.g. while email/password form is submitting) */
  disabled?: boolean;
  /** Optional error sink for parent Alert */
  onError?: (message: string) => void;
}

// Module-level guards — GIS `initialize` must be called exactly once per page load.
// Calling it per-mount (React StrictMode, sign-in ↔ sign-up navigation) triggers
// `GSI_LOGGER: google.accounts.id.initialize() is called multiple times`.
let gsiInitializedFor: string | null = null;
let gsiCallbackRef: ((response: { credential: string }) => void) | null = null;

export function GoogleSignInButton({
  text = "signin_with",
  redirectTo,
  disabled = false,
  onError,
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signInWithGoogle } = useAuth();

  const buttonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [gisError, setGisError] = useState<string | null>(null);

  const callbackUrl = getSafeCallbackUrl(redirectTo ?? searchParams.get("callbackUrl"));
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();

  const handleCredential = useCallback(
    async (response: { credential: string }) => {
      const credential = response?.credential;
      if (!credential) {
        const msg = "Google did not return a credential. Please try again.";
        setGisError(msg);
        onError?.(msg);
        return;
      }
      setLoading(true);
      setGisError(null);
      try {
        await signInWithGoogle(credential);
        router.push(callbackUrl);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Google sign-in failed. Please try again.";
        setGisError(msg);
        onError?.(msg);
      } finally {
        setLoading(false);
      }
    },
    [signInWithGoogle, router, callbackUrl, onError],
  );

  // Keep the latest callback in a ref so GIS can call it without re-initializing.
  useEffect(() => {
    gsiCallbackRef = handleCredential;
  }, [handleCredential]);

  useEffect(() => {
    if (!clientId) {
      Promise.resolve().then(() =>
        setGisError("Google sign-in is not configured (missing NEXT_PUBLIC_GOOGLE_CLIENT_ID)."),
      );
      return;
    }

    // GIS init — setState only inside promise callbacks per react-hooks/set-state-in-effect
    // Guard against multiple `initialize()` calls (React StrictMode + page navigations).
    const initGis = () => {
      try {
        if (!window.google?.accounts?.id) {
          Promise.resolve().then(() =>
            setGisError("Google Identity Services failed to load."),
          );
          return;
        }
        // Only call `initialize` once per clientId. Re-calling it logs
        // `GSI_LOGGER: google.accounts.id.initialize() is called multiple times`.
        if (gsiInitializedFor !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: { credential: string }) => gsiCallbackRef?.(response),
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          gsiInitializedFor = clientId;
        }

        if (buttonRef.current) {
          // Clear any prior button
          buttonRef.current.innerHTML = "";
          const width = buttonRef.current.offsetWidth || 320;
          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: "outline",
            size: "large",
            width,
            text,
            shape: "rectangular",
            logo_alignment: "left",
          });
        }
        Promise.resolve().then(() => setGisReady(true));
      } catch (err) {
        console.error("[GoogleSignInButton] GIS init error:", err);
        Promise.resolve().then(() => setGisError("Failed to initialize Google sign-in."));
      }
    };

    if (window.google?.accounts?.id) {
      Promise.resolve().then(initGis);
      return;
    }

    const existing = document.getElementById("google-gsi-client") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", initGis, { once: true });
      return () => existing.removeEventListener("load", initGis);
    }

    const script = document.createElement("script");
    script.id = "google-gsi-client";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initGis;
    script.onerror = () =>
      Promise.resolve().then(() =>
        setGisError("Failed to load Google sign-in script. Check your connection."),
      );
    document.head.appendChild(script);

    // No cleanup of script on unmount — keep for other mounts
    // `handleCredential` is read via `gsiCallbackRef` so it does NOT belong in deps — avoids re-initializing.
  }, [clientId, text]);

  // Re-render button when disabled changes (Google button has no disabled prop, so we overlay)
  const isDisabled = disabled || loading;

  if (!clientId) {
    return (
      <div className="rounded-card border border-border bg-card p-3 text-center">
        <p className="text-xs font-medium text-muted-foreground">
          Google sign-in is not configured. Set <code className="rounded bg-background px-1 py-0.5">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in <code>frontend/.env.local</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        {/* GIS renders its official button here */}
        <div
          ref={buttonRef}
          className="flex min-h-10 w-full items-center justify-center"
          aria-label="Sign in with Google"
        />
        {/* Loading/disabled overlay — GIS button has no native disabled, so we block pointer events */}
        {isDisabled && (
          <div className="absolute inset-0 flex items-center justify-center rounded-button bg-card/70 backdrop-blur-[1px]">
            <span className="text-xs font-medium text-muted-foreground">
              {loading ? "Signing in with Google…" : "Please wait…"}
            </span>
          </div>
        )}
        {/* Fallback while GIS is loading — show a styled placeholder so layout doesn't shift */}
        {!gisReady && !gisError && (
          <div className="absolute inset-0 flex items-center justify-center rounded-button border border-border bg-card">
            <span className="flex items-center gap-2 text-sm font-medium text-subtle-foreground">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22 .81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Loading Google…
            </span>
          </div>
        )}
      </div>
      {gisError && (
        <div className="space-y-2">
          <p role="alert" className="text-center text-xs font-medium text-red-600">
            {gisError}
          </p>
          {/* Detailed help for the most common GIS failure: origin_mismatch */}
          <div className="rounded-card border border-warning/30 bg-warning-bg p-3 text-left">
            <p className="text-xs font-semibold text-warning">
              Fix for “Error 400: origin_mismatch — Access blocked: Authorization Error”:
            </p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-warning">
              <li>
                Open{" "}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline hover:text-warning/80"
                >
                  Google Cloud Console → APIs &amp; Services → Credentials
                </a>{" "}
                → click your <strong>Web application</strong> Client ID (must match{" "}
                <code className="rounded bg-card px-1 py-0.5">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>).
              </li>
              <li>
                Under <strong>Authorized JavaScript origins</strong> click <strong>+ Add URI</strong> and add{" "}
                <code className="rounded bg-card px-1 py-0.5">http://localhost:3000</code>{" "}
                <em className="text-warning/80">exactly</em> — no trailing slash, include port. If you access the app via{" "}
                <code className="rounded bg-card px-1 py-0.5">http://127.0.0.1:3000</code> add that too. For
                production add <code className="rounded bg-card px-1 py-0.5">https://yourdomain.com</code>.
              </li>
              <li>
                Click <strong>Save</strong> → wait <strong>2–5 minutes</strong> for propagation → hard refresh{" "}
                <code className="rounded bg-card px-1 py-0.5">Ctrl+Shift+R</code> → try again. Verify{" "}
                <code className="rounded bg-card px-1 py-0.5">frontend/.env.local</code> has{" "}
                <code className="rounded bg-card px-1 py-0.5">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> and{" "}
                <code className="rounded bg-card px-1 py-0.5">GOOGLE_CLIENT_ID</code> equal, then restart{" "}
                <code className="rounded bg-card px-1 py-0.5">npm run dev</code> (Next.js inlines{" "}
                <code className="rounded bg-card px-1 py-0.5">NEXT_PUBLIC_*</code> at build).
              </li>
            </ol>
            <p className="mt-2 text-xs leading-relaxed text-warning/80">
              Tip: open DevTools → Console → look for{" "}
              <code className="rounded bg-card px-1 py-0.5">origin_mismatch</code> — Google logs the exact
              mismatched origin it saw (e.g. <code className="rounded bg-card px-1 py-0.5">http://localhost:3000</code>{" "}
              vs <code className="rounded bg-card px-1 py-0.5">http://localhost:3001</code>). Add that exact origin.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

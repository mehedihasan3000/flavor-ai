"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { UserRole } from "./types";
import { FLAG_COOKIE_NAME } from "./cookies";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  /** @deprecated Token is no longer exposed to client JS. Always `null`. Use the API proxy instead. */
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: (credential: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (token: string, user: AuthUser) => void;
  refresh: () => Promise<void>;
  patchUser: (patch: Partial<AuthUser>) => void;
}

/**
 * Reads the non-HttpOnly flag cookie to cheaply check if a session cookie
 * likely exists.  This avoids a network round-trip just to discover that the
 * user is a guest.
 */
function hasSessionFlagCookie(): boolean {
  if (typeof document === "undefined") return false;
  try {
    return document.cookie.split(";").some((c) => c.trim().startsWith(`${FLAG_COOKIE_NAME}=`));
  } catch {
    return false;
  }
}

/**
 * The proxy base for verifying the session and enriching the profile.
 * All calls go through the Next.js proxy which reads the HttpOnly cookie.
 */
const PROXY_BASE = "/api/proxy";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const patchUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  /**
   * setSession — kept for API compatibility.  With cookies, the token is
   * already set server-side by the auth route handler.  We only need to
   * update the React state with the user object.
   */
  const setSession = useCallback((_newToken: string, newUser: AuthUser) => {
    setUser(newUser);
  }, []);

  const refresh = useCallback(async () => {
    // If no flag cookie, there's no session to refresh — and any stale
    // in-memory user (e.g. cookies cleared by a 401 elsewhere) must go too,
    // otherwise the UI stays "signed in" with a dead session until reload.
    if (!hasSessionFlagCookie()) {
      setUser(null);
      return;
    }
    try {
      const res = await fetch(`${PROXY_BASE}/users/me`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) {
        if (res.status === 401) {
          setUser(null);
          if (typeof document !== "undefined") {
            document.cookie = `${FLAG_COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
          }
        }
        return;
      }
      const profile = (await res.json()) as {
        id: string;
        name: string;
        email: string;
        avatarUrl: string | null;
        role: UserRole;
      };
      setUser((prev) => {
        if (!prev) return prev;
        if (profile.id && profile.id !== prev.id) return prev;
        return {
          ...prev,
          name: profile.name ?? prev.name,
          email: profile.email ?? prev.email,
          avatarUrl: profile.avatarUrl ?? null,
          role: profile.role ?? prev.role,
        };
      });
    } catch {
      // silent — keep existing session
    }
  }, []);

  // Hydrate session on mount per React Compiler rules (state updates in promise callbacks only)
  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      // Quick check: if there's no flag cookie, the user is a guest
      if (!hasSessionFlagCookie()) {
        if (active) setIsLoading(false);
        return;
      }

      // Verify the session via the proxy (cookie auto-attached)
      return fetch(`${PROXY_BASE}/auth/token/verify`, {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      })
        .then((res) => {
          if (!res.ok) throw new Error("Invalid or expired session token.");
          return res.json();
        })
        .then((data: { user?: AuthUser }) => {
          if (!active) return;
          if (data?.user) {
            setUser(data.user);
            // Enrich with full profile (avatarUrl etc.) — non-blocking
            fetch(`${PROXY_BASE}/users/me`, {
              headers: { Accept: "application/json" },
              cache: "no-store",
              credentials: "same-origin",
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((profile: { id: string; name: string; email: string; avatarUrl: string | null; role: UserRole } | null) => {
                if (!active || !profile) return;
                setUser((prev) => {
                  if (!prev || profile.id !== prev.id) return prev;
                  return {
                    ...prev,
                    name: profile.name ?? prev.name,
                    email: profile.email ?? prev.email,
                    avatarUrl: profile.avatarUrl ?? null,
                    role: profile.role ?? prev.role,
                  };
                });
              })
              .catch(() => {
                // ignore enrichment failure
              });
          } else {
            // Invalid session — flag cookie will be cleared by the proxy on next request
            setUser(null);
          }
          setIsLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setUser(null);
          setIsLoading(false);
        });
    });

    return () => {
      active = false;
    };
  }, []);


  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "same-origin",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.safeMessage || "Invalid email or password.");
      }

      // The token is now set as an HttpOnly cookie by the route handler.
      // We only receive { user } in the JSON body.
      const { user: newUser } = data as { user: AuthUser };

      // Verify and register against backend database via the proxy
      try {
        const verifyRes = await fetch(`${PROXY_BASE}/auth/token/verify`, {
          method: "POST",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData?.user) {
            setUser(verifyData.user);
            return;
          }
        }
      } catch {
        // Backend optional fallback: use mint response
      }

      setUser(newUser);
    },
    [],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string): Promise<void> => {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
        credentials: "same-origin",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.safeMessage || "Failed to create account.");
      }

      const { user: newUser } = data as { user: AuthUser };

      // Verify and register against backend database via the proxy
      try {
        const verifyRes = await fetch(`${PROXY_BASE}/auth/token/verify`, {
          method: "POST",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData?.user) {
            setUser(verifyData.user);
            return;
          }
        }
      } catch {
        // Backend optional fallback
      }

      setUser(newUser);
    },
    [],
  );

  const signInWithGoogle = useCallback(
    async (credential: string): Promise<void> => {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
        credentials: "same-origin",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.safeMessage || "Google sign-in failed. Please try again.");
      }

      const { user: newUser } = data as { user: AuthUser };

      // Verify and hydrate against the backend database (same flow as email sign-in)
      try {
        const verifyRes = await fetch(`${PROXY_BASE}/auth/token/verify`, {
          method: "POST",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
        });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData?.user) {
            const backendUser = verifyData.user as AuthUser;
            const merged: AuthUser = {
              ...backendUser,
              avatarUrl: backendUser.avatarUrl ?? newUser.avatarUrl ?? null,
              name: backendUser.name || newUser.name,
            };
            setUser(merged);

            // If backend still has no avatar but Google provided one, persist it
            if (!backendUser.avatarUrl && newUser.avatarUrl) {
              fetch(`${PROXY_BASE}/users/me`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ avatarUrl: newUser.avatarUrl }),
                credentials: "same-origin",
              }).catch(() => {
                // silent — avatar will still show from merged state
              });
            }
            return;
          }
        }
      } catch {
        // Backend optional fallback
      }

      setUser(newUser);
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    setUser(null);
    if (typeof document !== "undefined") {
      document.cookie = `${FLAG_COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
    }

    // Call the server-side sign-out route which clears the HttpOnly cookie
    // and notifies the backend
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Cookie clearing is best-effort; UI state is already cleared
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token: null, // Token is no longer exposed to client JS
      isLoading,
      isAuthenticated: Boolean(user),
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      setSession,
      refresh,
      patchUser,
    }),
    [user, isLoading, signIn, signUp, signInWithGoogle, signOut, setSession, refresh, patchUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { useRequireAuth } from "./use-require-auth";

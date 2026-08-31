"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import type { UserRole } from "./types";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  /** Adopts a token minted by the Google OAuth callback route (see `/auth/callback`). */
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  setSession: (token: string, user: AuthUser) => void;
}

/** Best-effort, unverified read of the mint-time claims — used only as a UI
 * fallback when the backend verify round-trip is unreachable (matches the
 * mint-response fallback `signIn`/`signUp` already use). */
function decodeTokenUser(token: string): AuthUser | null {
  try {
    const [, payloadSegment] = token.split(".");
    if (!payloadSegment) return null;
    const json = atob(payloadSegment.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as {
      sub?: string;
      email?: string;
      name?: string;
      role?: UserRole;
      picture?: string;
    };
    if (!claims.sub || !claims.email) return null;
    return {
      id: claims.sub,
      email: claims.email,
      name: claims.name || "User",
      role: claims.role === "admin" ? "admin" : "user",
      avatarUrl: claims.picture ?? null,
    };
  } catch {
    return null;
  }
}

const STORAGE_KEY = "flavorai_auth_token";
const DEFAULT_API_URL = "http://localhost:4000/api/v1";

function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return DEFAULT_API_URL;
  return raw.replace(/\/+$/, "");
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync session helper
  const setSession = useCallback((newToken: string, newUser: AuthUser) => {
    try {
      localStorage.setItem(STORAGE_KEY, newToken);
    } catch {
      // ignore storage write errors
    }
    setToken(newToken);
    setUser(newUser);
  }, []);

  // Hydrate session on mount per React Compiler rules (state updates in promise callbacks only)
  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      let storedToken: string | null = null;
      try {
        storedToken = localStorage.getItem(STORAGE_KEY);
      } catch {
        storedToken = null;
      }

      if (!storedToken) {
        if (active) setIsLoading(false);
        return;
      }

      const apiUrl = getApiBaseUrl();
      return fetch(`${apiUrl}/auth/token/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${storedToken}`,
          Accept: "application/json",
        },
      })
        .then((res) => {
          if (!res.ok) throw new Error("Invalid or expired session token.");
          return res.json();
        })
        .then((data: { user?: AuthUser }) => {
          if (!active) return;
          if (data?.user) {
            setToken(storedToken);
            setUser(data.user);
          } else {
            try {
              localStorage.removeItem(STORAGE_KEY);
            } catch {
              // ignore
            }
            setToken(null);
            setUser(null);
          }
          setIsLoading(false);
        })
        .catch(() => {
          if (!active) return;
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            // ignore
          }
          setToken(null);
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
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.safeMessage || "Invalid email or password.");
      }

      const { token: newToken, user: newUser } = data as { token: string; user: AuthUser };

      // Verify and register against backend database
      try {
        const apiUrl = getApiBaseUrl();
        const verifyRes = await fetch(`${apiUrl}/auth/token/verify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${newToken}`,
            Accept: "application/json",
          },
        });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData?.user) {
            setSession(newToken, verifyData.user);
            return;
          }
        }
      } catch {
        // Backend optional fallback: use mint response
      }

      setSession(newToken, newUser);
    },
    [setSession],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string): Promise<void> => {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.safeMessage || "Failed to create account.");
      }

      const { token: newToken, user: newUser } = data as { token: string; user: AuthUser };

      // Verify and register against backend database
      try {
        const apiUrl = getApiBaseUrl();
        const verifyRes = await fetch(`${apiUrl}/auth/token/verify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${newToken}`,
            Accept: "application/json",
          },
        });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData?.user) {
            setSession(newToken, verifyData.user);
            return;
          }
        }
      } catch {
        // Backend optional fallback
      }

      setSession(newToken, newUser);
    },
    [setSession],
  );

  const signInWithToken = useCallback(
    async (newToken: string): Promise<void> => {
      const fallbackUser = decodeTokenUser(newToken);

      try {
        const apiUrl = getApiBaseUrl();
        const verifyRes = await fetch(`${apiUrl}/auth/token/verify`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${newToken}`,
            Accept: "application/json",
          },
        });
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          if (verifyData?.user) {
            setSession(newToken, verifyData.user);
            return;
          }
        }
      } catch {
        // Backend optional fallback: use the token's own claims below.
      }

      if (!fallbackUser) {
        throw new Error("Failed to establish a session from the Google sign-in token.");
      }
      setSession(newToken, fallbackUser);
    },
    [setSession],
  );

  const signOut = useCallback(async (): Promise<void> => {
    const currentToken = token;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setToken(null);
    setUser(null);

    if (currentToken) {
      try {
        const apiUrl = getApiBaseUrl();
        await fetch(`${apiUrl}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });
      } catch {
        // stateless logout: client cleanup already complete
      }
    }
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(token && user),
      signIn,
      signUp,
      signInWithToken,
      signOut,
      setSession,
    }),
    [user, token, isLoading, signIn, signUp, signInWithToken, signOut, setSession],
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


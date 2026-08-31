/**
 * Google OAuth 2.0 Authorization Code flow (server-side only).
 * Mirrors the "Better Auth bridge" pattern used by sign-in/sign-up: this
 * module talks to Google, then `lib/jwt.ts` mints the same HS256 token the
 * rest of the app already understands. `GOOGLE_CLIENT_SECRET` is read only
 * here — it never reaches a Client Component or the browser bundle.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_STATE_COOKIE = "flavorai_g_state";

export interface GoogleEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class GoogleOAuthConfigError extends Error {}

/** Reads Google credentials lazily (not at import time) so the app still boots without them. */
export function getGoogleEnv(requestOrigin: string): GoogleEnv {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new GoogleOAuthConfigError(
      "Google sign-in is not configured (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET).",
    );
  }
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || `${requestOrigin}/api/auth/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

/** Only allow same-app relative paths as a post-login destination — never an absolute/external URL. */
export function sanitizeCallbackPath(raw: string | null | undefined, fallback = "/profile"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  try {
    // Resolving against a dummy origin rejects `scheme:` and other browser-parsed tricks.
    const url = new URL(raw, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}

export function buildGoogleAuthUrl(env: GoogleEnv, state: string): string {
  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: env.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(env: GoogleEnv, code: string): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}).`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google userinfo request failed (${res.status}).`);
  }

  const data = (await res.json()) as Partial<GoogleUserInfo>;
  if (!data.sub || !data.email) {
    throw new Error("Google userinfo response is missing sub/email.");
  }

  return {
    sub: data.sub,
    email: data.email,
    email_verified: Boolean(data.email_verified),
    name: data.name,
    picture: data.picture,
  };
}

/** Deterministic `providerId` for Google users — namespaced so it can never collide
 * with the email-derived `usr_<hex>` ids the password stub mints. */
export function googleProviderId(sub: string): string {
  return `google_${sub}`;
}

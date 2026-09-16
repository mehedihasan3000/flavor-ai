/**
 * Shared cookie constants and helpers for the FlavorAI session cookie.
 *
 * The **HttpOnly** cookie (`COOKIE_NAME`) holds the JWT — inaccessible to
 * client-side JavaScript.  A second, **non-HttpOnly** flag cookie
 * (`FLAG_COOKIE_NAME`) is set alongside it so client code can cheaply check
 * "am I logged in?" without exposing the actual token.
 *
 * All auth route handlers (`sign-in`, `sign-up`, `google`) set both cookies
 * on success; the sign-out route clears them.
 */

/** Name of the HttpOnly cookie that stores the JWT. */
export const COOKIE_NAME = "flavorai_session";

/**
 * Non-HttpOnly flag cookie — its *value* is meaningless (just "1").
 * Its *presence* tells client JS that a session exists so the auth context
 * can attempt hydration without a round-trip to the server.
 */
export const FLAG_COOKIE_NAME = "flavorai_logged_in";

/** Max-age in seconds — mirrors the JWT expiry in `lib/jwt.ts`. */
export const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/** Whether to set `Secure` — only true in production (HTTPS). */
function isSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
}

/** Options for setting the HttpOnly session cookie. */
export function buildSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

/** Options for setting the non-HttpOnly logged-in flag cookie. */
export function buildFlagCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    secure: isSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

/** Options for clearing either cookie (maxAge = 0). */
export function buildClearCookieOptions(httpOnly: boolean): CookieOptions {
  return {
    httpOnly,
    secure: isSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  GOOGLE_STATE_COOKIE,
  GoogleOAuthConfigError,
  buildGoogleAuthUrl,
  getGoogleEnv,
  sanitizeCallbackPath,
} from "@/lib/google-oauth";

export const runtime = "nodejs";

/**
 * GET /api/auth/google?callbackUrl=/profile
 * Starts the Google OAuth 2.0 Authorization Code flow: stashes a CSRF nonce
 * in a short-lived httpOnly cookie, then redirects the browser to Google.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const callbackUrl = sanitizeCallbackPath(url.searchParams.get("callbackUrl"));

  let env;
  try {
    env = getGoogleEnv(url.origin);
  } catch (err) {
    if (err instanceof GoogleOAuthConfigError) {
      return NextResponse.redirect(new URL("/sign-in?error=google_unconfigured", url.origin));
    }
    throw err;
  }

  const nonce = randomBytes(24).toString("base64url");
  const state = Buffer.from(JSON.stringify({ n: nonce, cb: callbackUrl }), "utf8").toString("base64url");

  const response = NextResponse.redirect(buildGoogleAuthUrl(env, state));
  response.cookies.set(GOOGLE_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 600, // 10 minutes — just long enough for the Google consent round-trip
  });
  return response;
}

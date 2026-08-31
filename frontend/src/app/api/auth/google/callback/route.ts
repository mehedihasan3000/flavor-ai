import { NextResponse, type NextRequest } from "next/server";
import { mintAccessToken } from "@/lib/jwt";
import {
  GOOGLE_STATE_COOKIE,
  GoogleOAuthConfigError,
  exchangeCodeForTokens,
  fetchGoogleUserInfo,
  getGoogleEnv,
  googleProviderId,
  sanitizeCallbackPath,
} from "@/lib/google-oauth";

export const runtime = "nodejs";

function failure(origin: string, code: string) {
  const response = NextResponse.redirect(new URL(`/sign-in?error=${code}`, origin));
  response.cookies.delete(GOOGLE_STATE_COOKIE);
  return response;
}

/**
 * GET /api/auth/google/callback — Google redirects here with `code`/`state`.
 * Exchanges the code server-side (client secret never leaves this handler),
 * mints the app's usual HS256 JWT, and hands it to the browser via a URL
 * fragment so it never touches server logs or the Referer header.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;

  const error = url.searchParams.get("error");
  if (error) {
    return failure(origin, "google_denied");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return failure(origin, "google_failed");
  }

  let expectedNonce: string | undefined;
  let callbackUrl = "/profile";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      n?: string;
      cb?: string;
    };
    expectedNonce = decoded.n;
    callbackUrl = sanitizeCallbackPath(decoded.cb);
  } catch {
    return failure(origin, "google_state_mismatch");
  }

  const cookieNonce = request.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? null;
  if (!expectedNonce || !cookieNonce || expectedNonce !== cookieNonce) {
    return failure(origin, "google_state_mismatch");
  }

  let env;
  try {
    env = getGoogleEnv(origin);
  } catch (err) {
    if (err instanceof GoogleOAuthConfigError) {
      return failure(origin, "google_unconfigured");
    }
    throw err;
  }

  try {
    const tokens = await exchangeCodeForTokens(env, code);
    const profile = await fetchGoogleUserInfo(tokens.access_token);

    if (!profile.email_verified) {
      return failure(origin, "google_email_unverified");
    }

    const token = mintAccessToken({
      sub: googleProviderId(profile.sub),
      email: profile.email.toLowerCase(),
      name: profile.name?.trim() || profile.email.split("@")[0] || "User",
      role: "user",
      picture: profile.picture,
    });

    const hash = new URLSearchParams({ token, callbackUrl });
    const response = NextResponse.redirect(new URL(`/auth/callback#${hash.toString()}`, origin));
    response.cookies.delete(GOOGLE_STATE_COOKIE);
    return response;
  } catch (err) {
    console.error("[auth:google:callback] error:", err);
    return failure(origin, "google_failed");
  }
}


import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  FLAG_COOKIE_NAME,
  buildClearCookieOptions,
} from "@/lib/cookies";

const DEFAULT_API_URL = "http://localhost:4000/api/v1";

function getBackendBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return DEFAULT_API_URL;
  return raw.replace(/\/+$/, "");
}

/**
 * POST /api/auth/sign-out
 *
 * Clears the HttpOnly session cookie and the logged-in flag cookie, then
 * optionally calls the backend `/auth/logout` to invalidate the token
 * server-side (stateless fallback: client cleanup is sufficient).
 */
export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value ?? null;

  // Clear both cookies regardless of backend call outcome
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, "", buildClearCookieOptions(true));
  res.cookies.set(FLAG_COOKIE_NAME, "", buildClearCookieOptions(false));

  // Best-effort: notify the backend to invalidate the token (e.g. for token blacklisting)
  if (sessionToken) {
    try {
      await fetch(`${getBackendBaseUrl()}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
    } catch {
      // Stateless logout: client cleanup already complete
    }
  }

  return res;
}

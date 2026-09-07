import { NextResponse } from "next/server";
import { mintAccessToken } from "@/lib/jwt";
import {
  COOKIE_NAME,
  FLAG_COOKIE_NAME,
  buildSessionCookieOptions,
  buildFlagCookieOptions,
} from "@/lib/cookies";

const DEFAULT_API_URL = "http://localhost:4000/api/v1";

function getBackendBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return DEFAULT_API_URL;
  return raw.replace(/\/+$/, "");
}

interface BackendAuthUser {
  id: string;
  providerId?: string | null;
  email: string;
  name: string;
  role: "user" | "admin";
  avatarUrl?: string | null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body ?? {};

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { safeMessage: "Please provide a valid email address." },
        { status: 400 },
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { safeMessage: "Password must be at least 6 characters." },
        { status: 400 },
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Verify credentials against the backend (source of truth). The backend
    // returns 401 for unknown emails and wrong passwords — unknown users can
    // NO LONGER log in. No token is minted until the backend confirms.
    let backendUser: BackendAuthUser;
    try {
      const backendRes = await fetch(`${getBackendBaseUrl()}/auth/sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
        cache: "no-store",
      });
      const backendData = await backendRes.json().catch(() => null);
      if (!backendRes.ok) {
        const safeMessage =
          typeof backendData?.safeMessage === "string"
            ? backendData.safeMessage
            : "Invalid email or password.";
        return NextResponse.json(
          { safeMessage, validation: backendData?.validation },
          { status: backendRes.status },
        );
      }
      backendUser = (backendData as { user?: BackendAuthUser })?.user as BackendAuthUser;
      if (!backendUser?.email) {
        return NextResponse.json(
          { safeMessage: "Invalid email or password." },
          { status: 401 },
        );
      }
    } catch {
      return NextResponse.json(
        { safeMessage: "Cannot reach the authentication service. Please try again." },
        { status: 503 },
      );
    }

    // Mint only after backend verification. Role/name come from the database —
    // never derived from the email address (prevents privilege escalation).
    const providerId =
      backendUser.providerId ||
      `usr_${Buffer.from(backendUser.email).toString("hex").slice(0, 24)}`;

    const token = mintAccessToken({
      sub: providerId,
      email: backendUser.email,
      name: backendUser.name,
      role: backendUser.role,
      avatarUrl: backendUser.avatarUrl ?? null,
    });

    // Set the JWT as an HttpOnly cookie (inaccessible to client JS) and a
    // non-HttpOnly flag cookie so the client can check "am I logged in?".
    const res = NextResponse.json({
      user: {
        id: backendUser.id,
        email: backendUser.email,
        name: backendUser.name,
        role: backendUser.role,
        avatarUrl: backendUser.avatarUrl ?? null,
      },
    });
    res.cookies.set(COOKIE_NAME, token, buildSessionCookieOptions());
    res.cookies.set(FLAG_COOKIE_NAME, "1", buildFlagCookieOptions());
    return res;
  } catch (error) {
    console.error("[auth:sign-in] error:", error);
    return NextResponse.json(
      { safeMessage: "An error occurred while signing in. Please try again." },
      { status: 500 },
    );
  }
}

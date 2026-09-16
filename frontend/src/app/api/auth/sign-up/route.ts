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
    const { name, email, password } = body ?? {};

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { safeMessage: "Please provide your display name." },
        { status: 400 },
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { safeMessage: "Please provide a valid email address." },
        { status: 400 },
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { safeMessage: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // Create the account in the backend first (source of truth). The backend
    // returns 409 if the email is already registered with a password.
    let backendUser: BackendAuthUser;
    try {
      const backendRes = await fetch(`${getBackendBaseUrl()}/auth/sign-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: cleanName, email: cleanEmail, password }),
        cache: "no-store",
      });
      const backendData = await backendRes.json().catch(() => null);
      if (!backendRes.ok) {
        const safeMessage =
          typeof backendData?.safeMessage === "string"
            ? backendData.safeMessage
            : "Failed to create account. Please try again.";
        return NextResponse.json(
          { safeMessage, validation: backendData?.validation },
          { status: backendRes.status },
        );
      }
      backendUser = (backendData as { user?: BackendAuthUser })?.user as BackendAuthUser;
      if (!backendUser?.email) {
        return NextResponse.json(
          { safeMessage: "Failed to create account. Please try again." },
          { status: 500 },
        );
      }
    } catch {
      return NextResponse.json(
        { safeMessage: "Cannot reach the authentication service. Please try again." },
        { status: 503 },
      );
    }

    // New accounts are ALWAYS role "user" (backend-enforced). Mint after creation.
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
    console.error("[auth:sign-up] error:", error);
    return NextResponse.json(
      { safeMessage: "An error occurred while creating your account. Please try again." },
      { status: 500 },
    );
  }
}

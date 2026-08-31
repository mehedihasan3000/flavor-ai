import { NextResponse } from "next/server";
import { mintAccessToken } from "@/lib/jwt";

interface GoogleTokenInfo {
  iss: string;
  azp?: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: string | boolean;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  exp: string;
  iat: string;
}

function getGoogleClientId(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    undefined
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const credential: unknown = body?.credential ?? body?.idToken ?? body?.id_token;

    if (!credential || typeof credential !== "string") {
      return NextResponse.json(
        { safeMessage: "Missing Google credential. Please try again." },
        { status: 400 },
      );
    }

    const clientId = getGoogleClientId();
    if (!clientId) {
      console.error("[auth:google] missing GOOGLE_CLIENT_ID env");
      return NextResponse.json(
        { safeMessage: "Google sign-in is not configured. Please contact support." },
        { status: 500 },
      );
    }

    // Verify the Google ID token via Google's tokeninfo endpoint.
    // This validates signature, expiry, issuer and audience server-side.
    const tokenInfoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
      { cache: "no-store" },
    );

    if (!tokenInfoRes.ok) {
      const errText = await tokenInfoRes.text().catch(() => "");
      console.warn("[auth:google] tokeninfo failed", tokenInfoRes.status, errText.slice(0, 300));
      return NextResponse.json(
        { safeMessage: "Google verification failed. Please try again." },
        { status: 401 },
      );
    }

    const payload = (await tokenInfoRes.json()) as GoogleTokenInfo;

    // Validate issuer
    const issuerOk =
      payload.iss === "https://accounts.google.com" || payload.iss === "accounts.google.com";
    if (!issuerOk) {
      return NextResponse.json(
        { safeMessage: "Invalid Google token issuer." },
        { status: 401 },
      );
    }

    // Validate audience matches our client ID
    if (payload.aud !== clientId) {
      // Allow azp check as fallback for some token shapes, but aud must match
      return NextResponse.json(
        { safeMessage: "Google token audience mismatch." },
        { status: 401 },
      );
    }

    // Validate email_verified
    const emailVerified = payload.email_verified === true || payload.email_verified === "true";
    if (!emailVerified) {
      return NextResponse.json(
        { safeMessage: "Google email is not verified." },
        { status: 401 },
      );
    }

    // Validate expiry
    const expSeconds = Number(payload.exp);
    if (Number.isFinite(expSeconds) && expSeconds * 1000 < Date.now()) {
      return NextResponse.json(
        { safeMessage: "Google token has expired. Please try again." },
        { status: 401 },
      );
    }

    const email = payload.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { safeMessage: "Google account is missing an email address." },
        { status: 401 },
      );
    }

    const displayName =
      (payload.name?.trim() || payload.given_name?.trim() || email.split("@")[0] || "User").trim();
    const picture: string | null = typeof payload.picture === "string" ? payload.picture : null;

    const isAdmin = email.startsWith("admin@") || email.includes("admin");

    // Deterministic providerId derived from email so Google and email/password share the same FlavorAI account
    const providerId = `usr_${Buffer.from(email).toString("hex").slice(0, 24)}`;

    const token = mintAccessToken({
      sub: providerId,
      email,
      name: displayName,
      role: isAdmin ? "admin" : "user",
      avatarUrl: picture,
    });

    return NextResponse.json({
      token,
      user: {
        id: providerId,
        email,
        name: displayName,
        role: isAdmin ? "admin" : "user",
        avatarUrl: picture,
      },
    });
  } catch (error) {
    console.error("[auth:google] error:", error);
    return NextResponse.json(
      { safeMessage: "An error occurred during Google sign-in. Please try again." },
      { status: 500 },
    );
  }
}

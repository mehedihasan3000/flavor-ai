import { NextResponse } from "next/server";
import { mintAccessToken } from "@/lib/jwt";

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
    const isAdmin = cleanEmail.startsWith("admin@") || cleanEmail.includes("admin");
    const baseName = cleanEmail.split("@")[0] || "User";
    const displayName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    
    // Deterministic provider ID derived from email
    const providerId = `usr_${Buffer.from(cleanEmail).toString("hex").slice(0, 24)}`;

    const token = mintAccessToken({
      sub: providerId,
      email: cleanEmail,
      name: displayName,
      role: isAdmin ? "admin" : "user",
    });

    return NextResponse.json({
      token,
      user: {
        id: providerId,
        email: cleanEmail,
        name: displayName,
        role: isAdmin ? "admin" : "user",
      },
    });
  } catch (error) {
    console.error("[auth:sign-in] error:", error);
    return NextResponse.json(
      { safeMessage: "An error occurred while signing in. Please try again." },
      { status: 500 },
    );
  }
}

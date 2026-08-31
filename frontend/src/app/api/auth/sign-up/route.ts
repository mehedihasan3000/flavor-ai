import { NextResponse } from "next/server";
import { mintAccessToken } from "@/lib/jwt";

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
    const providerId = `usr_${Buffer.from(cleanEmail).toString("hex").slice(0, 24)}`;

    const token = mintAccessToken({
      sub: providerId,
      email: cleanEmail,
      name: cleanName,
      role: "user",
    });

    return NextResponse.json({
      token,
      user: {
        id: providerId,
        email: cleanEmail,
        name: cleanName,
        role: "user",
      },
    });
  } catch (error) {
    console.error("[auth:sign-up] error:", error);
    return NextResponse.json(
      { safeMessage: "An error occurred while creating your account. Please try again." },
      { status: 500 },
    );
  }
}

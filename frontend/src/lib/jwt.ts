import { createHmac } from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET || "flavorai-dev-jwt-secret-key-change-in-prod";
const JWT_ISSUER = process.env.JWT_ISSUER || "flavorai";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "flavorai-api";
const JWT_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60; // 7 days

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlEncodeBuffer(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export interface MintTokenPayload {
  sub: string;
  email: string;
  name?: string;
  role?: "user" | "admin";
  /** OAuth provider avatar (e.g. Google `picture`); synced to `User.avatarUrl` on first sign-in. */
  picture?: string;
}

/**
 * Mints an HS256 JWT access token compatible with Express backend verification (middleware/auth.ts).
 * Keeps secret server-side per SRS §9.4.
 */
export function mintAccessToken(payload: MintTokenPayload): string {
  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    sub: payload.sub,
    email: payload.email,
    name: payload.name ?? "User",
    role: payload.role ?? "user",
    ...(payload.picture ? { picture: payload.picture } : {}),
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: now,
    exp: now + JWT_EXPIRES_IN_SECONDS,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = createHmac("sha256", JWT_SECRET)
    .update(signatureInput)
    .digest();

  const encodedSignature = base64UrlEncodeBuffer(signature);

  return `${signatureInput}.${encodedSignature}`;
}

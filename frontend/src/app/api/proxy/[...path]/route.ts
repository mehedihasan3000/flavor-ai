import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
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
 * Catch-all API proxy that reads the HttpOnly session cookie and forwards
 * requests to the Express backend with an `Authorization: Bearer` header.
 *
 * Client-side code fetches `/api/proxy/<path>` — the browser auto-attaches
 * cookies (same origin), and this route converts the cookie into a header
 * that the backend expects.  The JWT never reaches client-side JavaScript.
 *
 * Supports GET, POST, PATCH, PUT, DELETE.
 */

type Params = Promise<{ path: string[] }>;

async function proxyRequest(
  request: NextRequest,
  params: Params,
): Promise<NextResponse> {
  const { path } = await params;
  const backendPath = path.join("/");
  const url = new URL(request.url);
  const search = url.search; // preserve query string

  const targetUrl = `${getBackendBaseUrl()}/${backendPath}${search}`;

  // Read the session cookie
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(COOKIE_NAME)?.value ?? null;

  // Build headers to forward (strip host/cookie — we add Authorization instead)
  const forwardHeaders: Record<string, string> = {
    Accept: "application/json",
  };

  const contentType = request.headers.get("content-type");
  if (contentType) {
    forwardHeaders["Content-Type"] = contentType;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    forwardHeaders.Authorization = authHeader;
  } else if (sessionToken) {
    forwardHeaders.Authorization = `Bearer ${sessionToken}`;
  }

  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
    if (!body) body = undefined;
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        status: 502,
        code: "INTERNAL_ERROR",
        safeMessage:
          "Cannot reach the FlavorAI API. Check your connection and try again.",
      },
      { status: 502 },
    );
  }

  // If the backend returns 401 and the session cookie was used for auth,
  // the session cookie is invalid/expired. Clear it so the client flag cookie and hydration stay in sync.
  if (backendResponse.status === 401 && !authHeader && sessionToken) {
    const responseBody = await backendResponse.text();
    const res = new NextResponse(responseBody, {
      status: 401,
      headers: { "Content-Type": backendResponse.headers.get("content-type") ?? "application/json" },
    });
    res.cookies.set(COOKIE_NAME, "", buildClearCookieOptions(true));
    res.cookies.set(FLAG_COOKIE_NAME, "", buildClearCookieOptions(false));
    return res;
  }

  // Stream the backend response body through
  const responseBody = await backendResponse.arrayBuffer();
  const res = new NextResponse(responseBody, {
    status: backendResponse.status,
    headers: {
      "Content-Type":
        backendResponse.headers.get("content-type") ?? "application/json",
    },
  });

  return res;
}

export async function GET(
  request: NextRequest,
  context: { params: Params },
): Promise<NextResponse> {
  return proxyRequest(request, context.params);
}

export async function POST(
  request: NextRequest,
  context: { params: Params },
): Promise<NextResponse> {
  return proxyRequest(request, context.params);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Params },
): Promise<NextResponse> {
  return proxyRequest(request, context.params);
}

export async function PUT(
  request: NextRequest,
  context: { params: Params },
): Promise<NextResponse> {
  return proxyRequest(request, context.params);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Params },
): Promise<NextResponse> {
  return proxyRequest(request, context.params);
}

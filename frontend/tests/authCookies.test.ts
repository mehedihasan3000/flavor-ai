import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  FLAG_COOKIE_NAME,
  buildClearCookieOptions,
  buildFlagCookieOptions,
  buildSessionCookieOptions,
} from "@/lib/cookies";
import { GET as proxyGet, POST as proxyPost } from "@/app/api/proxy/[...path]/route";
import { POST as signOut } from "@/app/api/auth/sign-out/route";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

function mockCookieStore(values: Record<string, string | undefined>) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      values[name] !== undefined ? { name, value: values[name] as string } : undefined,
  } as never);
}

function stubBackendFetch(body: unknown = {}, status = 200, contentType = "application/json") {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": contentType },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function proxyContext(...segments: string[]) {
  return { params: Promise.resolve({ path: segments }) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("lib/cookies — session cookie options", () => {
  it("sets HttpOnly session cookie with lax samesite, root path, 7-day max-age", () => {
    const opts = buildSessionCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBe(COOKIE_MAX_AGE);
    expect(COOKIE_MAX_AGE).toBe(7 * 24 * 60 * 60);
  });

  it("sets a readable (non-HttpOnly) flag cookie with matching lifetime", () => {
    const opts = buildFlagCookieOptions();
    expect(opts.httpOnly).toBe(false);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.maxAge).toBe(COOKIE_MAX_AGE);
  });

  it("clears cookies with maxAge 0 while preserving the httpOnly split", () => {
    const clearSession = buildClearCookieOptions(true);
    const clearFlag = buildClearCookieOptions(false);
    expect(clearSession.maxAge).toBe(0);
    expect(clearSession.httpOnly).toBe(true);
    expect(clearFlag.maxAge).toBe(0);
    expect(clearFlag.httpOnly).toBe(false);
  });
});

describe("proxy [...path] route — cookie → Authorization forwarding", () => {
  it("forwards the session cookie as a Bearer header and preserves the query string", async () => {
    mockCookieStore({ [COOKIE_NAME]: "session-jwt-abc" });
    const fetchMock = stubBackendFetch({ ok: true });

    const res = await proxyGet(
      new NextRequest("http://localhost:3000/api/proxy/users/me?foo=bar"),
      proxyContext("users", "me"),
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/v1/users/me?foo=bar");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer session-jwt-abc",
    );
  });

  it("prefers an explicit Authorization header over the cookie", async () => {
    mockCookieStore({ [COOKIE_NAME]: "session-jwt-abc" });
    const fetchMock = stubBackendFetch({ ok: true });

    await proxyGet(
      new NextRequest("http://localhost:3000/api/proxy/recipes", {
        headers: { Authorization: "Bearer explicit-token" },
      }),
      proxyContext("recipes"),
    );

    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe(
      "Bearer explicit-token",
    );
  });

  it("clears both cookies on a cookie-authed 401 (expired session)", async () => {
    mockCookieStore({ [COOKIE_NAME]: "stale-jwt" });
    stubBackendFetch({ code: "UNAUTHORIZED" }, 401);

    const res = await proxyGet(
      new NextRequest("http://localhost:3000/api/proxy/users/me"),
      proxyContext("users", "me"),
    );

    expect(res.status).toBe(401);
    expect(res.cookies.get(COOKIE_NAME)?.value).toBe("");
    expect(res.cookies.get(FLAG_COOKIE_NAME)?.value).toBe("");
  });

  it("does NOT clear cookies on 401 when an explicit Authorization header was used", async () => {
    mockCookieStore({ [COOKIE_NAME]: "valid-session-jwt" });
    stubBackendFetch({ code: "UNAUTHORIZED" }, 401);

    const res = await proxyGet(
      new NextRequest("http://localhost:3000/api/proxy/users/me", {
        headers: { Authorization: "Bearer stale-explicit-token" },
      }),
      proxyContext("users", "me"),
    );

    expect(res.status).toBe(401);
    expect(res.cookies.get(COOKIE_NAME)).toBeUndefined();
    expect(res.cookies.get(FLAG_COOKIE_NAME)).toBeUndefined();
  });

  it("forwards POST body and content-type to the backend", async () => {
    mockCookieStore({ [COOKIE_NAME]: "session-jwt-abc" });
    const fetchMock = stubBackendFetch({ ok: true });

    await proxyPost(
      new NextRequest("http://localhost:3000/api/proxy/recipes/123/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Nice!" }),
      }),
      proxyContext("recipes", "123", "comments"),
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ body: "Nice!" }));
  });

  it("returns a 502 envelope when the backend is unreachable", async () => {
    mockCookieStore({ [COOKIE_NAME]: "session-jwt-abc" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("connection refused")),
    );

    const res = await proxyGet(
      new NextRequest("http://localhost:3000/api/proxy/users/me"),
      proxyContext("users", "me"),
    );

    expect(res.status).toBe(502);
    const payload = (await res.json()) as { safeMessage: string };
    expect(payload.safeMessage).toMatch(/cannot reach/i);
  });
});

describe("sign-out route — cookie clearing", () => {
  it("clears both cookies and notifies the backend with the session token", async () => {
    mockCookieStore({ [COOKIE_NAME]: "session-jwt-abc" });
    const fetchMock = stubBackendFetch({});

    const res = await signOut();

    expect((await res.json()) as { success: boolean }).toEqual({ success: true });
    expect(res.cookies.get(COOKIE_NAME)?.value).toBe("");
    expect(res.cookies.get(FLAG_COOKIE_NAME)?.value).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/v1/auth/logout");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer session-jwt-abc",
    );
  });

  it("clears cookies without calling the backend when no session exists", async () => {
    mockCookieStore({});
    const fetchMock = stubBackendFetch({});

    const res = await signOut();

    expect((await res.json()) as { success: boolean }).toEqual({ success: true });
    expect(res.cookies.get(COOKIE_NAME)?.value).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

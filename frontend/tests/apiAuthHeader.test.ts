import { afterEach, describe, expect, it, vi } from "vitest";
import { getMyProfile, listRecipes } from "@/lib/api";

function stubFetch(body: unknown = {}, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client cookie-based authentication", () => {
  it("routes requests through the /api/proxy endpoint with credentials: same-origin", async () => {
    const fetchMock = stubFetch({ preferences: null });

    await getMyProfile();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/proxy/users/me");
    expect(init.credentials).toBe("same-origin");
  });

  it("sends no Authorization header client-side when no explicit token is passed (cookie handled by proxy)", async () => {
    const fetchMock = stubFetch({ preferences: null });

    await getMyProfile();

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("sends no Authorization header for listRecipes without explicit token", async () => {
    const fetchMock = stubFetch({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

    await listRecipes();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/proxy/recipes");
    expect(init.credentials).toBe("same-origin");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("attaches explicit Authorization header when token is explicitly passed (for SSR/server components)", async () => {
    const fetchMock = stubFetch({ preferences: null });

    await getMyProfile({ token: "ssr-token-xyz" });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ssr-token-xyz");
  });

  it("suppresses Authorization header when token is explicitly null", async () => {
    const fetchMock = stubFetch({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

    await listRecipes({}, { token: null });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

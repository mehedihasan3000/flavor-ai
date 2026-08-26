import { afterEach, describe, expect, it, vi } from "vitest";
import { getMyProfile, listRecipes } from "@/lib/api";

const AUTH_STORAGE_KEY = "flavorai_auth_token";

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
  window.localStorage.clear();
});

describe("api client automatic auth header", () => {
  it("attaches the persisted session token when no explicit token is passed", async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "session-token-123");
    const fetchMock = stubFetch({ preferences: null });

    await getMyProfile();

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer session-token-123");
  });

  it("attaches the token on authenticated mutations (createRecipe path)", async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "session-token-456");
    const fetchMock = stubFetch({ recipe: {} });

    await listRecipes({ mine: true });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer session-token-456");
  });

  it("sends no Authorization header for guests", async () => {
    const fetchMock = stubFetch({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

    await listRecipes();

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("explicit null token suppresses the persisted token", async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "session-token-789");
    const fetchMock = stubFetch({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

    await listRecipes({}, { token: null });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("explicit token overrides the persisted one", async () => {
    window.localStorage.setItem(AUTH_STORAGE_KEY, "stored-token");
    const fetchMock = stubFetch({ averageRating: 0, ratingCount: 0 });

    await getMyProfile({ token: "override-token" });

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer override-token");
  });
});

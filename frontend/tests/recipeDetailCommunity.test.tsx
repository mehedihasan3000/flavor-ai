import { Suspense } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RecipeDetailPage from "../src/app/recipes/[id]/page";
import * as authContext from "../src/lib/auth-context";
import type { Recipe } from "../src/lib/types";
import { ToastProvider } from "../src/components/ui/toast";

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: {
    getRecipe: vi.fn(),
    getRatingSummary: vi.fn(),
    getFavoriteStatus: vi.fn(),
    listComments: vi.fn(),
  },
}));

vi.mock("../src/lib/api", async () => {
  const actual = await vi.importActual("../src/lib/api");
  return { ...actual, ...apiMocks };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
}));

function mockAuth(userId: string | null) {
  vi.spyOn(authContext, "useAuth").mockReturnValue({
    user: userId
      ? { id: userId, email: "chef@example.com", name: "Chef", role: "user" }
      : null,
    token: userId ? "valid-jwt-token" : null,
    isAuthenticated: Boolean(userId),
    isLoading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    setSession: vi.fn(),
    refresh: vi.fn(),
    patchUser: vi.fn(),
  });
}

function recipeFixture(overrides: Partial<Recipe>): Recipe {
  return {
    id: "r1",
    owner: "u1",
    source: "manual",
    title: "Test Recipe",
    slug: "test-recipe",
    ingredients: [],
    steps: [],
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    totalTimeMinutes: 15,
    servings: 2,
    difficulty: "easy",
    tags: [],
    dietaryLabels: [],
    allergenWarnings: [],
    status: "published",
    averageRating: 0,
    ratingCount: 0,
    favoriteCount: 0,
    commentCount: 0,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

async function renderPage(id: string) {
  // The page unwraps `params` via React's `use()`, which suspends until the
  // promise settles — render inside async act so the retry flushes.
  await act(async () => {
    render(
      <ToastProvider>
        <Suspense fallback={<div>Loading test page…</div>}>
          <RecipeDetailPage params={Promise.resolve({ id })} />
        </Suspense>
      </ToastProvider>,
    );
  });
}

describe("RecipeDetailPage community gating (draft/hidden 404 regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides the comment thread with a clear message on a draft (owner view)", async () => {
    mockAuth("u1");
    apiMocks.getRecipe.mockResolvedValue(
      recipeFixture({ id: "r-draft", title: "Draft Soup", status: "draft", owner: "u1" }),
    );

    await renderPage("r-draft");

    await screen.findByRole("heading", { name: "Draft Soup" });
    expect(
      screen.getByText("This recipe is still a draft. Publish it to start the conversation."),
    ).toBeInTheDocument();

    // The published-only APIs must never be hit for a draft…
    await waitFor(() => expect(apiMocks.getRecipe).toHaveBeenCalled());
    expect(apiMocks.listComments).not.toHaveBeenCalled();
    expect(apiMocks.getRatingSummary).not.toHaveBeenCalled();
    expect(apiMocks.getFavoriteStatus).not.toHaveBeenCalled();

    // …and no misleading 404 error is surfaced.
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(screen.queryByText("Recipe not found.")).not.toBeInTheDocument();

    // Favorite is disabled with guidance instead of silently failing.
    expect(screen.getByRole("button", { name: /favorite/i })).toBeDisabled();
  });

  it("hides the comment thread with a clear message on a hidden recipe", async () => {
    mockAuth("u1");
    apiMocks.getRecipe.mockResolvedValue(
      recipeFixture({ id: "r-hidden", title: "Hidden Stew", status: "hidden", owner: "u1" }),
    );

    await renderPage("r-hidden");

    await screen.findByRole("heading", { name: "Hidden Stew" });
    expect(
      screen.getByText("This recipe is currently hidden, so comments are unavailable."),
    ).toBeInTheDocument();

    await waitFor(() => expect(apiMocks.getRecipe).toHaveBeenCalled());
    expect(apiMocks.listComments).not.toHaveBeenCalled();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("still loads comments, ratings, and favorites for published recipes", async () => {
    mockAuth("u2");
    apiMocks.getRecipe.mockResolvedValue(
      recipeFixture({ id: "r-pub", title: "Published Pie", status: "published", owner: "u1" }),
    );
    apiMocks.getRatingSummary.mockResolvedValue({ averageRating: 4.5, ratingCount: 2 });
    apiMocks.getFavoriteStatus.mockResolvedValue({ favorited: false });
    apiMocks.listComments.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, totalPages: 0 });

    await renderPage("r-pub");

    await screen.findByRole("heading", { name: "Published Pie" });
    // Comment thread renders (empty state) and the list API was called.
    expect(await screen.findByText("No comments yet")).toBeInTheDocument();
    expect(apiMocks.listComments).toHaveBeenCalled();
    expect(apiMocks.getRatingSummary).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /favorite/i })).toBeEnabled();
  });
});

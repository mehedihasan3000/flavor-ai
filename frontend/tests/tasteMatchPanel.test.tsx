import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TasteMatchPanel } from "../src/components/recipes/taste-match-panel";
import * as authContext from "../src/lib/auth-context";

const { matchRecipesToTaste } = vi.hoisted(() => {
  const mockMatches = [
    {
      recipe: {
        id: "r1",
        title: "Spicy Miso Ramen",
        slug: "spicy-miso-ramen",
        summary: "A fiery miso ramen bowl.",
        imageUrl: undefined,
        category: "main-course" as const,
        difficulty: "medium" as const,
        dietaryLabels: [],
        source: "manual" as const,
        status: "published" as const,
        averageRating: 4.5,
        ratingCount: 10,
        favoriteCount: 3,
        totalTimeMinutes: 30,
      },
      score: 92,
      matchedTastes: ["spicy" as const, "umami" as const],
      reason: "Chili oil and miso broth deliver a strong spicy-umami combination.",
    },
  ];
  return { mockMatches, matchRecipesToTaste: vi.fn().mockResolvedValue({ matches: mockMatches }) };
});

vi.mock("../src/lib/api", async () => {
  const actual = await vi.importActual("../src/lib/api");
  return {
    ...actual,
    matchRecipesToTaste,
  };
});

function mockAuth(isAuthenticated: boolean) {
  vi.spyOn(authContext, "useAuth").mockReturnValue({
    user: isAuthenticated ? { id: "u1", email: "chef@example.com", name: "Chef", role: "user" } : null,
    // Client JS never holds a token post cookie-migration (HttpOnly session cookie instead)
    token: null,
    isAuthenticated,
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

describe("TasteMatchPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prompts guests to sign in instead of showing the taste picker", () => {
    mockAuth(false);
    render(<TasteMatchPanel />);

    expect(screen.getByText(/use the AI Taste Matcher/i)).toBeInTheDocument();
    expect(screen.queryByText("Spicy")).not.toBeInTheDocument();
  });

  it("requires at least one taste before searching", async () => {
    mockAuth(true);
    render(<TasteMatchPanel />);

    fireEvent.click(screen.getByRole("button", { name: /find my matches/i }));

    await waitFor(() => {
      expect(screen.getByText(/select at least one taste/i)).toBeInTheDocument();
    });
    expect(matchRecipesToTaste).not.toHaveBeenCalled();
  });

  it("toggles taste selection and requests AI-matched recipes", async () => {
    mockAuth(true);
    render(<TasteMatchPanel />);

    const spicyButton = screen.getByRole("button", { name: /^spicy$/i });
    fireEvent.click(spicyButton);
    expect(spicyButton).toHaveAttribute("aria-pressed", "true");

    const umamiButton = screen.getByRole("button", { name: /^umami$/i });
    fireEvent.click(umamiButton);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /find my matches/i }));
    });

    await waitFor(() => {
      expect(matchRecipesToTaste).toHaveBeenCalledWith(
        expect.objectContaining({ tastes: ["spicy", "umami"], limit: 12 }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Spicy Miso Ramen")).toBeInTheDocument();
      expect(screen.getByText(/92% match/i)).toBeInTheDocument();
    });
  });
});

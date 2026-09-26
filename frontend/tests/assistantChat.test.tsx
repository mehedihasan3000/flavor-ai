import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AssistantPage from "../src/app/assistant/page";
import * as authContext from "../src/lib/auth-context";
import { AuthProvider } from "../src/lib/auth-context";
import {
  ApiError,
  chatWithAssistant,
  getAssistantRecommendations,
  getMacroAdjustments,
  getRecipe,
} from "../src/lib/api";
import { ASSISTANT_STORAGE_KEY } from "../src/lib/assistant-storage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/assistant",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../src/lib/api", async () => {
  const actual = await vi.importActual("../src/lib/api");
  return {
    ...actual,
    getMyProfile: vi.fn().mockResolvedValue({
      preferences: { dietaryLabels: [], allergies: [], dislikedIngredients: [] },
    }),
    chatWithAssistant: vi.fn(),
    getAssistantRecommendations: vi.fn(),
    getPantrySuggestions: vi.fn(),
    getMacroAdjustments: vi.fn(),
    getRecipe: vi.fn(),
  };
});

const mockChat = vi.mocked(chatWithAssistant);
const mockMacro = vi.mocked(getMacroAdjustments);
const mockRecommend = vi.mocked(getAssistantRecommendations);
const mockGetRecipe = vi.mocked(getRecipe);

function mockAuth(isAuthenticated: boolean) {
  vi.spyOn(authContext, "useAuth").mockReturnValue({
    user: isAuthenticated
      ? { id: "u1", email: "chef@example.com", name: "Chef", role: "user" }
      : null,
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

describe("AssistantPage — Food & Nutrition AI Assistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockAuth(true);
    mockChat.mockResolvedValue({ message: "Try the Chicken Rice Bowl.", contextUsed: ["profile"] });
  });

  async function renderPage() {
    await act(async () => {
      render(
        <AuthProvider>
          <AssistantPage />
        </AuthProvider>,
      );
    });
  }

  it("restores a stored conversation on mount in original order", async () => {
    window.sessionStorage.setItem(
      ASSISTANT_STORAGE_KEY,
      JSON.stringify([
        { id: "a", role: "user", text: "Stored question", time: "09:00", origin: "chat" },
        { id: "b", role: "assistant", text: "Stored answer", time: "09:01", origin: "chat" },
      ]),
    );
    await renderPage();
    const question = await screen.findByText("Stored question");
    expect(question).toBeInTheDocument();
    expect(screen.getByText("Stored answer")).toBeInTheDocument();
    // Ordering preserved: user turn renders before the assistant turn
    expect(question.compareDocumentPosition(screen.getByText("Stored answer"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("falls back to an empty conversation on corrupt storage without crashing", async () => {
    window.sessionStorage.setItem(ASSISTANT_STORAGE_KEY, "not-json{{{");
    await renderPage();
    expect(screen.getByText("What can I make with my pantry?")).toBeInTheDocument();
    expect(screen.queryByLabelText("Ask the assistant")).toBeInTheDocument();
  });

  it("persists sent messages and replies to sessionStorage", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Ask the assistant"), {
      target: { value: "Persist me please" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByText("Try the Chicken Rice Bowl.")).toBeInTheDocument();
    });
    const raw = window.sessionStorage.getItem(ASSISTANT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw as string) as Array<{ role: string; text: string }>;
    expect(stored.map((m) => m.text)).toEqual([
      "Persist me please",
      "Try the Chicken Rice Bowl.",
    ]);
  });

  it("anchors the sent message near the top without scrolling the page", async () => {
    const containerScrollTo = vi.fn();
    const pageScrollTo = vi.fn();
    window.HTMLElement.prototype.scrollTo = containerScrollTo;
    window.scrollTo = pageScrollTo;
    try {
      await renderPage();
      fireEvent.change(screen.getByLabelText("Ask the assistant"), {
        target: { value: "Scroll check please" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));

      await waitFor(() => {
        expect(screen.getByText("Try the Chicken Rice Bowl.")).toBeInTheDocument();
      });
      // Container-only smooth anchoring on send and on reply — never the
      // document itself. Snaps wait for post-paint frames, so poll until
      // the stub fires.
      await waitFor(() => {
        expect(containerScrollTo).toHaveBeenCalled();
      });
      for (const call of containerScrollTo.mock.calls) {
        expect(call[0]).toMatchObject({ behavior: "smooth" });
        expect(typeof call[0].top).toBe("number");
      }
      expect(pageScrollTo).not.toHaveBeenCalled();
    } finally {
      // @ts-expect-error restore jsdom default (no scrollTo)
      delete window.HTMLElement.prototype.scrollTo;
      // @ts-expect-error restore jsdom default (no scrollTo)
      delete window.scrollTo;
    }
  });

  it("clears the conversation and session storage via Clear chat", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Ask the assistant"), {
      target: { value: "Clear me please" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => {
      expect(screen.getByText("Try the Chicken Rice Bowl.")).toBeInTheDocument();
    });
    expect(window.sessionStorage.getItem(ASSISTANT_STORAGE_KEY)).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /clear chat/i }));
    await waitFor(() => {
      expect(screen.getByText("What can I make with my pantry?")).toBeInTheDocument();
    });
    expect(screen.queryByText("Clear me please")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(ASSISTANT_STORAGE_KEY)).toBe(JSON.stringify([]));
  });

  it("gates guests behind the sign-in prompt", async () => {
    mockAuth(false);
    await renderPage();
    expect(screen.getByText("Sign In Required")).toBeInTheDocument();
    expect(screen.queryByLabelText("Ask the assistant")).not.toBeInTheDocument();
  });

  it("renders the header, quick prompts, and composer", async () => {
    await renderPage();
    expect(screen.getByText("Your personalized AI food companion")).toBeInTheDocument();
    expect(screen.getByText("What can I make with my pantry?")).toBeInTheDocument();
    expect(screen.getByLabelText("Ask the assistant")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
  });

  it("sends a message and renders the assistant reply", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Ask the assistant"), {
      target: { value: "Recommend a high-protein dinner." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByText("Recommend a high-protein dinner.")).toBeInTheDocument();
      expect(screen.getByText("Try the Chicken Rice Bowl.")).toBeInTheDocument();
    });
    expect(mockChat).toHaveBeenCalledTimes(1);
    expect(mockChat.mock.calls[0][0]).toMatchObject({
      message: "Recommend a high-protein dinner.",
    });
  });

  it("shows a loading state while sending", async () => {
    let resolveChat!: (v: { message: string; contextUsed: [] }) => void;
    mockChat.mockReturnValue(
      new Promise((resolve) => {
        resolveChat = resolve;
      }),
    );
    await renderPage();
    fireEvent.change(screen.getByLabelText("Ask the assistant"), { target: { value: "Hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Assistant is thinking…")).toBeInTheDocument();
    await act(async () => {
      resolveChat({ message: "Hello!", contextUsed: [] });
    });
  });

  it("shows an error state when the request fails", async () => {
    mockChat.mockRejectedValue(
      new ApiError(502, "AI_PROVIDER_ERROR", "AI service is currently unavailable. Please try again."),
    );
    await renderPage();
    fireEvent.change(screen.getByLabelText("Ask the assistant"), { target: { value: "Hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByText("AI service is currently unavailable. Please try again.")).toBeInTheDocument();
    });
  });

  it("quick prompts submit immediately", async () => {
    await renderPage();
    fireEvent.click(screen.getByText("How can I increase my protein intake?"));

    await waitFor(() => {
      expect(mockChat).toHaveBeenCalledTimes(1);
    });
    expect(mockChat.mock.calls[0][0]).toMatchObject({
      message: "How can I increase my protein intake?",
    });
  });

  it("sends prior turns as history without duplicating the current message", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Ask the assistant"), { target: { value: "First question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => {
      expect(mockChat).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Ask the assistant"), { target: { value: "Second question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => {
      expect(mockChat).toHaveBeenCalledTimes(2);
    });
    const secondCall = mockChat.mock.calls[1][0];
    expect(secondCall.message).toBe("Second question");
    const historyTexts = (secondCall.history as Array<{ message: string }>).map((t) => t.message);
    expect(historyTexts.filter((t) => t === "Second question")).toHaveLength(0);
    expect(historyTexts).toContain("First question");
  });

  it("adjusts macros via the Adjust macros action and renders the macro card", async () => {
    mockMacro.mockResolvedValue({
      recommendation: { calories: 2250, proteinGrams: 150, carbohydratesGrams: 220, fatGrams: 65 },
      changes: [{ meal: "Lunch", change: "Increase chicken portion by approximately 50g" }],
      reason: "Adds protein while staying close to the calorie target.",
    });
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Adjust macros" }));

    await waitFor(() => {
      expect(mockMacro).toHaveBeenCalledTimes(1);
    });
    expect(mockMacro.mock.calls[0][0]).toMatchObject({
      request: "Suggest adjustments to help meet my targets.",
    });
    expect(await screen.findByText("150 g")).toBeInTheDocument();
    expect(screen.getByText(/Increase chicken portion/)).toBeInTheDocument();
  });

  it("rejects non-integer targets client-side without calling the API", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Daily calorie target (optional)"), {
      target: { value: "2.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adjust macros" }));

    expect(await screen.findByText(/whole numbers/)).toBeInTheDocument();
    expect(mockMacro).not.toHaveBeenCalled();
    expect(mockChat).not.toHaveBeenCalled();
  });

  it("rejects out-of-range targets matching backend limits", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Daily calorie target (optional)"), {
      target: { value: "30000" },
    });
    fireEvent.change(screen.getByLabelText("Ask the assistant"), { target: { value: "Hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText(/1–20000/)).toBeInTheDocument();
    expect(mockChat).not.toHaveBeenCalled();
  });

  it("shows an error when recommendation details fail to load", async () => {
    mockRecommend.mockResolvedValue({
      recommendations: [
        { recipeId: "dead-beef", title: "Ghost", reason: "Ranked but gone.", matchScore: 90 },
      ],
    });
    mockGetRecipe.mockRejectedValue(new Error("gone"));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Recommend recipes" }));

    expect(
      await screen.findByText("Recommendations arrived but their details could not be loaded. Please try again."),
    ).toBeInTheDocument();
  });

  it("includes pantry items when provided", async () => {
    await renderPage();
    const pantryInput = screen.getByPlaceholderText("e.g. chicken — press Enter to add");
    fireEvent.change(pantryInput, { target: { value: "chicken" } });
    fireEvent.keyDown(pantryInput, { key: "Enter" });
    expect(await screen.findByText("chicken")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Ask the assistant"), {
      target: { value: "What can I make?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(mockChat).toHaveBeenCalledTimes(1);
    });
    expect(mockChat.mock.calls[0][0]).toMatchObject({ pantryItems: ["chicken"] });
  });
});

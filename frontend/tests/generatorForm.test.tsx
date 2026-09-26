import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchParams } from "next/navigation";
import GeneratorPage, { parsePrefilledIngredients } from "../src/app/generator/page";
import * as authContext from "../src/lib/auth-context";
import { AuthProvider } from "../src/lib/auth-context";
import { ToastProvider } from "../src/components/ui/toast";
import {
  createRecipe,
  generateAIRecipe,
  publishRecipe,
  unpublishRecipe,
} from "../src/lib/api";

function renderGenerator() {
  return render(
    <AuthProvider>
      <ToastProvider>
        <GeneratorPage />
      </ToastProvider>
    </AuthProvider>,
  );
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/generator",
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("../src/lib/api", async () => {
  const actual = await vi.importActual("../src/lib/api");
  return {
    ...actual,
    getMyProfile: vi.fn().mockResolvedValue({
      preferences: {
        dietaryLabels: ["vegetarian"],
        allergies: ["peanuts"],
        dislikedIngredients: [],
      },
    }),
    generateAIRecipe: vi.fn(),
    createRecipe: vi.fn(),
    publishRecipe: vi.fn(),
    unpublishRecipe: vi.fn(),
    suggestFlavorPairings: vi.fn(),
  };
});

describe("Frontend Form & Component: GeneratorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders generator form inputs and dietary checkboxes", async () => {
    await act(async () => {
      renderGenerator();
    });

    expect(screen.getByText("Generate Smart Recipes")).toBeInTheDocument();
    expect(
      screen.getByText(/Turn your available ingredients into custom/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Pantry Ingredients/i)[0]).toBeInTheDocument();
    expect(screen.getByText("Dietary Restrictions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate recipe/i })).toBeInTheDocument();
  });

  it("shows validation error when attempting to generate with empty ingredients", async () => {
    await act(async () => {
      renderGenerator();
    });

    const generateButton = screen.getByRole("button", {
      name: /generate recipe/i,
    });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(
        screen.getByText(/please add at least one ingredient from your pantry/i),
      ).toBeInTheDocument();
    });
  });

  it("adds ingredient tags and toggles dietary preferences", async () => {
    await act(async () => {
      renderGenerator();
    });

    const input = screen.getByPlaceholderText(/add ingredient/i);
    fireEvent.change(input, { target: { value: "tofu" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("tofu")).toBeInTheDocument();

    const veganCheckbox = screen.getByLabelText("Vegan");
    fireEvent.click(veganCheckbox);
    expect(veganCheckbox).toBeChecked();
  });

  it("parses ?ingredients= prefill param (dedupes, trims, caps length)", () => {
    expect(parsePrefilledIngredients(null)).toEqual([]);
    expect(parsePrefilledIngredients("")).toEqual([]);
    expect(
      parsePrefilledIngredients("salmon fillet, quinoa,  , Salmon Fillet, olive oil"),
    ).toEqual(["salmon fillet", "quinoa", "olive oil"]);
  });

  it("prefills ingredient tags from ?ingredients= search param", async () => {
    vi.mocked(useSearchParams).mockReturnValueOnce(
      new URLSearchParams({
        ingredients: "salmon fillet, quinoa, olive oil",
      }) as unknown as ReturnType<typeof useSearchParams>,
    );

    await act(async () => {
      renderGenerator();
    });

    expect(screen.getByText("salmon fillet")).toBeInTheDocument();
    expect(screen.getByText("quinoa")).toBeInTheDocument();
    expect(screen.getByText(/prefilled 3 ingredients from your photo/i)).toBeInTheDocument();
  });

  it("shows a success toast when a generated recipe is saved as a draft", async () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: { id: "u1", email: "chef@example.com", name: "Chef", role: "user" },
      token: "test-token",
      isAuthenticated: true,
      isLoading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      setSession: vi.fn(),
      refresh: vi.fn(),
      patchUser: vi.fn(),
    });
    const mockRecipe = {
      title: "Garlic Butter Chicken",
      summary: "Quick weeknight dinner",
      ingredients: [{ name: "chicken breast", quantity: 2, unit: "pieces" }],
      steps: [{ stepNumber: 1, instruction: "Sear chicken in a hot skillet." }],
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      servings: 2,
      difficulty: "easy",
      tags: [],
      dietaryLabels: [],
      allergenWarnings: [],
    };
    vi.mocked(generateAIRecipe).mockResolvedValue({
      recipe: mockRecipe,
      pantryMatch: {
        usedIngredients: ["chicken breast"],
        missingIngredients: [],
        usageCount: 1,
        missingCount: 0,
      },
    } as never);
    vi.mocked(createRecipe).mockResolvedValue({ id: "recipe-123" } as never);

    await act(async () => {
      renderGenerator();
    });

    const input = screen.getByPlaceholderText(/add ingredient/i);
    fireEvent.change(input, { target: { value: "chicken breast" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const generateButton = screen.getByRole("button", { name: /generate recipe/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText("Garlic Butter Chicken")).toBeInTheDocument();
    });

    const saveButton = screen.getByRole("button", { name: /save as draft/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      // Inline success Alert + success toast share the message
      expect(screen.getAllByText(/saved as draft\./i)).toHaveLength(2);
    });
    expect(screen.getByText("Saved as draft")).toBeInTheDocument();

    // Draft action is now locked, but Publish stays available for the same record.
    expect(createRecipe).toHaveBeenCalledTimes(1);
    const savedButton = screen.getByRole("button", { name: /saved ✓/i });
    expect(savedButton).toBeDisabled();
    const publishButtonAfterSave = screen.getByRole("button", { name: /publish recipe/i });
    expect(publishButtonAfterSave).not.toBeDisabled();
    // Repeat draft clicks are ignored.
    fireEvent.click(savedButton);
    expect(createRecipe).toHaveBeenCalledTimes(1);

    // Publishing the saved draft reuses the same record — no second create.
    vi.mocked(publishRecipe).mockResolvedValue({ id: "recipe-123" } as never);
    fireEvent.click(publishButtonAfterSave);

    await waitFor(() => {
      expect(screen.getAllByText(/published successfully!/i)).toHaveLength(2);
    });
    expect(createRecipe).toHaveBeenCalledTimes(1);
    expect(publishRecipe).toHaveBeenCalledWith("recipe-123", expect.anything());
    expect(screen.getByRole("button", { name: /published ✓/i })).toBeDisabled();
    // Repeat publish clicks are ignored.
    fireEvent.click(screen.getByRole("button", { name: /published ✓/i }));
    expect(publishRecipe).toHaveBeenCalledTimes(1);
  });

  it("shows a success toast when a generated recipe is published", async () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: { id: "u1", email: "chef@example.com", name: "Chef", role: "user" },
      token: "test-token",
      isAuthenticated: true,
      isLoading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      setSession: vi.fn(),
      refresh: vi.fn(),
      patchUser: vi.fn(),
    });
    const mockRecipe = {
      title: "Garlic Butter Chicken",
      summary: "Quick weeknight dinner",
      ingredients: [{ name: "chicken breast", quantity: 2, unit: "pieces" }],
      steps: [{ stepNumber: 1, instruction: "Sear chicken in a hot skillet." }],
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      servings: 2,
      difficulty: "easy",
      tags: [],
      dietaryLabels: [],
      allergenWarnings: [],
    };
    vi.mocked(generateAIRecipe).mockResolvedValue({
      recipe: mockRecipe,
      pantryMatch: {
        usedIngredients: ["chicken breast"],
        missingIngredients: [],
        usageCount: 1,
        missingCount: 0,
      },
    } as never);
    vi.mocked(createRecipe).mockResolvedValue({ id: "recipe-123" } as never);
    vi.mocked(publishRecipe).mockResolvedValue({ id: "recipe-123" } as never);

    await act(async () => {
      renderGenerator();
    });

    const input = screen.getByPlaceholderText(/add ingredient/i);
    fireEvent.change(input, { target: { value: "chicken breast" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const generateButton = screen.getByRole("button", { name: /generate recipe/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText("Garlic Butter Chicken")).toBeInTheDocument();
    });

    const publishButton = screen.getByRole("button", { name: /publish recipe/i });
    fireEvent.click(publishButton);

    await waitFor(() => {
      // Inline success Alert + success toast share the message
      expect(screen.getAllByText(/published successfully!/i)).toHaveLength(2);
    });
    expect(screen.getByText("Published")).toBeInTheDocument();

    // Publish action is now locked, but Save as Draft stays available.
    expect(createRecipe).toHaveBeenCalledTimes(1);
    expect(publishRecipe).toHaveBeenCalledTimes(1);
    const publishedButton = screen.getByRole("button", { name: /published ✓/i });
    expect(publishedButton).toBeDisabled();
    const draftButtonAfterPublish = screen.getByRole("button", { name: /save as draft/i });
    expect(draftButtonAfterPublish).not.toBeDisabled();
    // Repeat publish clicks are ignored.
    fireEvent.click(publishedButton);
    expect(publishRecipe).toHaveBeenCalledTimes(1);

    // Moving back to draft reuses the same record — no second create.
    vi.mocked(unpublishRecipe).mockResolvedValue({ id: "recipe-123" } as never);
    fireEvent.click(draftButtonAfterPublish);

    await waitFor(() => {
      expect(screen.getAllByText(/moved back to draft\./i)).toHaveLength(2);
    });
    expect(createRecipe).toHaveBeenCalledTimes(1);
    expect(unpublishRecipe).toHaveBeenCalledWith("recipe-123", expect.anything());
    expect(screen.getByRole("button", { name: /saved ✓/i })).toBeDisabled();
  });

  it("shows busy text only on the clicked button while saving", async () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: { id: "u1", email: "chef@example.com", name: "Chef", role: "user" },
      token: "test-token",
      isAuthenticated: true,
      isLoading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      setSession: vi.fn(),
      refresh: vi.fn(),
      patchUser: vi.fn(),
    });
    const mockRecipe = {
      title: "Garlic Butter Chicken",
      summary: "Quick weeknight dinner",
      ingredients: [{ name: "chicken breast", quantity: 2, unit: "pieces" }],
      steps: [{ stepNumber: 1, instruction: "Sear chicken in a hot skillet." }],
      prepTimeMinutes: 10,
      cookTimeMinutes: 15,
      servings: 2,
      difficulty: "easy",
      tags: [],
      dietaryLabels: [],
      allergenWarnings: [],
    };
    vi.mocked(generateAIRecipe).mockResolvedValue({
      recipe: mockRecipe,
      pantryMatch: {
        usedIngredients: ["chicken breast"],
        missingIngredients: [],
        usageCount: 1,
        missingCount: 0,
      },
    } as never);
    let resolveCreate!: (value: unknown) => void;
    vi.mocked(createRecipe).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }) as never,
    );

    await act(async () => {
      renderGenerator();
    });

    const input = screen.getByPlaceholderText(/add ingredient/i);
    fireEvent.change(input, { target: { value: "chicken breast" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const generateButton = screen.getByRole("button", { name: /generate recipe/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText("Garlic Butter Chicken")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /save as draft/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^saving\.\.\.$/i })).toBeInTheDocument();
    });
    // The idle Publish button keeps its own label — never "Publishing...".
    expect(screen.getByRole("button", { name: /^publish recipe$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publishing\.\.\./i })).not.toBeInTheDocument();

    resolveCreate({ id: "recipe-123" });

    await waitFor(() => {
      expect(screen.getAllByText(/saved as draft\./i)).toHaveLength(2);
    });
  });
});

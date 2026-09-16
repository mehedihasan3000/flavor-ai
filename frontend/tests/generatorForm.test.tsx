import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSearchParams } from "next/navigation";
import GeneratorPage, { parsePrefilledIngredients } from "../src/app/generator/page";
import { AuthProvider } from "../src/lib/auth-context";

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
    suggestFlavorPairings: vi.fn(),
  };
});

describe("Frontend Form & Component: GeneratorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders generator form inputs and dietary checkboxes", async () => {
    await act(async () => {
      render(
        <AuthProvider>
          <GeneratorPage />
        </AuthProvider>,
      );
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
      render(
        <AuthProvider>
          <GeneratorPage />
        </AuthProvider>,
      );
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
      render(
        <AuthProvider>
          <GeneratorPage />
        </AuthProvider>,
      );
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
      render(
        <AuthProvider>
          <GeneratorPage />
        </AuthProvider>,
      );
    });

    expect(screen.getByText("salmon fillet")).toBeInTheDocument();
    expect(screen.getByText("quinoa")).toBeInTheDocument();
    expect(screen.getByText(/prefilled 3 ingredients from your photo/i)).toBeInTheDocument();
  });
});

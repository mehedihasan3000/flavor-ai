import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NutritionAnalyzerPage from "../src/app/nutrition-analyzer/page";
import { NutritionBreakdownView } from "../src/components/nutrition/nutrition-breakdown-view";
import { PhotoDropzone } from "../src/components/nutrition/photo-dropzone";
import * as authContext from "../src/lib/auth-context";
import { AuthProvider } from "../src/lib/auth-context";

const { mockAnalysisData } = vi.hoisted(() => ({
  mockAnalysisData: {
    dishName: "Grilled Salmon Bowl",
    summary: "A balanced meal with salmon fillet and quinoa.",
    detectedFoods: [
      {
        name: "Salmon Fillet",
        portion: "150g",
        confidence: "high" as const,
        calories: 280,
        proteinGrams: 34,
        carbsGrams: 0,
        fatGrams: 15,
        fiberGrams: 0,
      },
      {
        name: "Quinoa",
        portion: "100g",
        confidence: "medium" as const,
        calories: 120,
        proteinGrams: 4,
        carbsGrams: 21,
        fatGrams: 2,
        fiberGrams: 3,
      },
    ],
    totalNutrition: {
      calories: { min: 380, max: 420, estimate: 400 },
      proteinGrams: { min: 35, max: 41, estimate: 38 },
      carbsGrams: { min: 18, max: 24, estimate: 21 },
      fatGrams: { min: 15, max: 19, estimate: 17 },
      fiberGrams: { min: 2, max: 4, estimate: 3 },
    },
    macroDistribution: {
      proteinPercentage: 38,
      carbsPercentage: 23,
      fatPercentage: 39,
    },
    dietaryTags: ["high-protein" as const, "gluten-free" as const],
    allergenWarnings: ["Fish"],
    healthInsights: ["High lean protein source"],
    suggestedIngredientsForRecipe: ["salmon", "quinoa", "olive oil"],
    disclaimer: "Visual estimate only.",
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/nutrition-analyzer",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../src/lib/api", async () => {
  const actual = await vi.importActual("../src/lib/api");
  return {
    ...actual,
    getMyProfile: vi.fn().mockResolvedValue({
      preferences: { dietaryLabels: [], allergies: [], dislikedIngredients: [] },
    }),
    analyzeFoodPhoto: vi.fn().mockResolvedValue(mockAnalysisData),
  };
});

describe("Food Photo Nutrition Analysis Frontend Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PhotoDropzone Component", () => {
    it("renders dropzone and sample food dishes for 1-click testing", () => {
      const handleSelected = vi.fn();
      const handleClear = vi.fn();

      render(
        <PhotoDropzone
          selectedImage={null}
          onImageSelected={handleSelected}
          onClear={handleClear}
        />,
      );

      expect(screen.getByText(/Upload or snap a food photo/i)).toBeInTheDocument();
      expect(screen.getByText(/Grilled Salmon & Quinoa/i)).toBeInTheDocument();
      expect(screen.getByText(/Mediterranean Chicken Salad/i)).toBeInTheDocument();

      // Click sample preset
      const sampleBtn = screen.getByText(/Grilled Salmon & Quinoa/i);
      fireEvent.click(sampleBtn);
      expect(handleSelected).toHaveBeenCalledWith(
        expect.stringContaining("https://images.unsplash.com"),
        "image/jpeg",
        "salmon-plate.jpg",
        expect.any(String),
      );
    });

    it("renders image preview and allows removal when an image is selected", () => {
      const handleSelected = vi.fn();
      const handleClear = vi.fn();

      render(
        <PhotoDropzone
          selectedImage="https://images.unsplash.com/sample.jpg"
          onImageSelected={handleSelected}
          onClear={handleClear}
        />,
      );

      expect(screen.getByAltText("Selected food preview")).toBeInTheDocument();
      const removeBtn = screen.getByRole("button", { name: /remove selected photo/i });
      fireEvent.click(removeBtn);
      expect(handleClear).toHaveBeenCalled();
    });
  });

  describe("NutritionBreakdownView Component", () => {
    it("renders dish name, calories, macro distributions, and detected food items", () => {
      render(<NutritionBreakdownView analysis={mockAnalysisData} />);

      expect(screen.getByText("Grilled Salmon Bowl")).toBeInTheDocument();
      expect(screen.getByText("400")).toBeInTheDocument();
      expect(screen.getByText(/Range: 380 – 420 kcal/i)).toBeInTheDocument();
      expect(screen.getByText(/Protein \(38%\)/i)).toBeInTheDocument();
      expect(screen.getByText("Salmon Fillet")).toBeInTheDocument();
      expect(screen.getByText(/High Confidence/i)).toBeInTheDocument();
      expect(screen.getByText("Generate Recipe")).toBeInTheDocument();
    });
  });

  describe("NutritionAnalyzerPage Flow", () => {
    it("renders page header and handles sample selection and analysis submission", async () => {
      vi.spyOn(authContext, "useAuth").mockReturnValue({
        user: {
          id: "u1",
          email: "chef@example.com",
          name: "Chef Flavor",
          role: "user",
        },
        token: "valid-jwt-token",
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

      await act(async () => {
        render(
          <AuthProvider>
            <NutritionAnalyzerPage />
          </AuthProvider>,
        );
      });

      expect(
        screen.getByText("Analyze Nutrition from a Plate Photo"),
      ).toBeInTheDocument();

      // Select sample preset
      const sampleBtn = screen.getByText(/Grilled Salmon & Quinoa/i);
      await act(async () => {
        fireEvent.click(sampleBtn);
      });

      // Analyze button should now be enabled
      const analyzeBtn = screen.getByRole("button", { name: /analyze photo nutrition/i });
      expect(analyzeBtn).not.toBeDisabled();

      await act(async () => {
        fireEvent.click(analyzeBtn);
      });

      // Verify analysis view rendered
      await waitFor(() => {
        expect(screen.getByText("Grilled Salmon Bowl")).toBeInTheDocument();
        expect(screen.getByText("Analyze Another Meal")).toBeInTheDocument();
      });
    });
  });
});

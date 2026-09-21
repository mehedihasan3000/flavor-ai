import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NutritionAnalyzerPage from "../src/app/nutrition-analyzer/page";
import { NutritionBreakdownView } from "../src/components/nutrition/nutrition-breakdown-view";
import {
  PhotoDropzone,
  estimateJsonPayloadBytes,
  needsCompressionForVercel,
  VERCEL_SAFE_JSON_LIMIT_BYTES,
} from "../src/components/nutrition/photo-dropzone";
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

    it("advertises 15 MB max with auto-optimization (not a raw 10 MB passthrough)", () => {
      render(
        <PhotoDropzone selectedImage={null} onImageSelected={vi.fn()} onClear={vi.fn()} />,
      );
      expect(screen.getByText(/max 15 MB/i)).toBeInTheDocument();
      expect(screen.getByText(/auto-optimized/i)).toBeInTheDocument();
    });
  });

  describe("Vercel 4.5 MB payload gate (production root cause)", () => {
    const MB = 1024 * 1024;

    it.each([
      { sizeMB: 1, compress: false },
      { sizeMB: 2, compress: false },
      { sizeMB: 5, compress: true },
      { sizeMB: 6, compress: true },
      { sizeMB: 7, compress: true },
      { sizeMB: 10, compress: true },
      { sizeMB: 12, compress: true },
    ])(
      "$sizeMB MB original → needsCompression=$compress (raw JSON would be ~$sizeMB MB base64)",
      ({ sizeMB, compress }) => {
        expect(needsCompressionForVercel(sizeMB * MB)).toBe(compress);
      },
    );

    it("raw 5–7 MB photos exceed the Vercel cap as JSON (why prod 413'd while localhost passed)", () => {
      for (const sizeMB of [5, 6, 7]) {
        const jsonBytes = estimateJsonPayloadBytes(sizeMB * 1024 * 1024);
        // Base64 inflates ~33%: 5 MB → ~6.8 MB, 7 MB → ~9.5 MB — all > 4.5 MB.
        expect(jsonBytes).toBeGreaterThan(4_500_000);
        expect(jsonBytes).toBeGreaterThan(VERCEL_SAFE_JSON_LIMIT_BYTES);
      }
    });

    it("1–2 MB photos fit the Vercel cap as-is (working case stays untouched)", () => {
      for (const sizeMB of [1, 2]) {
        expect(estimateJsonPayloadBytes(sizeMB * 1024 * 1024)).toBeLessThan(
          VERCEL_SAFE_JSON_LIMIT_BYTES,
        );
      }
    });

    it("compressed 2.8 MB budget fits the Vercel cap with margin", () => {
      expect(estimateJsonPayloadBytes(2_800_000)).toBeLessThan(VERCEL_SAFE_JSON_LIMIT_BYTES);
      expect(estimateJsonPayloadBytes(2_800_000)).toBeLessThan(4_500_000);
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

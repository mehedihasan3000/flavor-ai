"use client";

import { useState } from "react";
import { Sparkles, ArrowRotateRight, TriangleExclamation, Camera } from "@gravity-ui/icons";
import { AuthGuard } from "@/components/auth";
import { PhotoDropzone } from "@/components/nutrition/photo-dropzone";
import { NutritionBreakdownView } from "@/components/nutrition/nutrition-breakdown-view";
import { Button, Input, Textarea, Alert, Spinner } from "@/components/ui";
import { analyzeFoodPhoto } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { FoodPhotoAnalysisResult } from "@/lib/types";

export default function NutritionAnalyzerPage() {
  const { token } = useAuth();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [filename, setFilename] = useState<string | undefined>(undefined);
  const [mealContext, setMealContext] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<FoodPhotoAnalysisResult | null>(null);

  const handleImageSelected = (
    imageData: string,
    detectedMime: string,
    name?: string,
    sampleContext?: string,
  ) => {
    setSelectedImage(imageData);
    setMimeType(detectedMime);
    setFilename(name);
    if (sampleContext) {
      setMealContext(sampleContext);
    }
    setError(null);
  };

  const handleClear = () => {
    setSelectedImage(null);
    setFilename(undefined);
    setMealContext("");
    setNotes("");
    setError(null);
    setAnalysisResult(null);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      setError("Please select or upload a food photo first.");
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeFoodPhoto(
        {
          image: selectedImage,
          mimeType,
          filename,
          mealContext: mealContext.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        token ? { token } : {},
      );

      setAnalysisResult(result);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to analyze the photo. Please check your image and try again.";
      setError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <AuthGuard>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header Hero */}
        <div className="text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3.5 py-1 text-xs font-semibold text-primary-strong">
            <Camera className="size-3.5" aria-hidden="true" />
            <span>AI Food Photo Nutrition Analysis</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
            Analyze Nutrition from a Plate Photo
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-subtle-foreground">
            Snap or upload a photo of your meal. FlavorAI detects ingredients, calculates portion sizes,
            and provides detailed calorie & macronutrient breakdowns.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6">
            <Alert variant="danger">
              <div className="flex items-center gap-2">
                <TriangleExclamation className="size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            </Alert>
          </div>
        )}

        {!analysisResult ? (
          /* Analysis Input Form */
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-7">
              <PhotoDropzone
                selectedImage={selectedImage}
                onImageSelected={handleImageSelected}
                onClear={handleClear}
                disabled={analyzing}
              />
            </div>

            <div className="lg:col-span-5 rounded-3xl border border-border bg-card p-6 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-heading flex items-center gap-2">
                <Sparkles className="size-4 text-primary-strong" aria-hidden="true" />
                Optional Meal Context
              </h2>
              <p className="text-xs text-subtle-foreground leading-relaxed">
                Providing meal context or notes helps FlavorAI identify hidden ingredients, dressings, or preparation methods accurately.
              </p>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="meal-context"
                    className="block text-xs font-semibold text-heading mb-1.5"
                  >
                    Meal Description / Context
                  </label>
                  <Input
                    id="meal-context"
                    placeholder="e.g. Grilled salmon with lemon butter sauce"
                    value={mealContext}
                    onChange={(e) => setMealContext(e.target.value)}
                    disabled={analyzing}
                  />
                </div>

                <div>
                  <label
                    htmlFor="meal-notes"
                    className="block text-xs font-semibold text-heading mb-1.5"
                  >
                    Additional Notes / Diet
                  </label>
                  <Textarea
                    id="meal-notes"
                    rows={2}
                    placeholder="e.g. Cooked in olive oil, no added salt"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={analyzing}
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full justify-center shadow-md hover:shadow-lg font-bold"
                  onClick={handleAnalyze}
                  disabled={!selectedImage || analyzing}
                >
                  {analyzing ? (
                    <>
                      <Spinner className="size-4 mr-2" />
                      <span>Analyzing Food Photo...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4 mr-2" />
                      <span>Analyze Photo Nutrition</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Analysis Results View */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="gap-1.5"
              >
                <ArrowRotateRight className="size-3.5" aria-hidden="true" />
                <span>Analyze Another Meal</span>
              </Button>
            </div>

            <NutritionBreakdownView
              analysis={analysisResult}
              imageUrl={selectedImage}
            />
          </div>
        )}
      </div>
    </AuthGuard>
  );
}

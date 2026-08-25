"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, createRecipe, publishRecipe } from "@/lib/api";
import type { CreateRecipeInput } from "@/lib/types";
import { RecipeForm } from "@/components/recipes/recipe-form";

export default function CreateRecipePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (input: CreateRecipeInput, publish: boolean) => {
    setSubmitError(null);
    setServerErrors({});
    setIsSubmitting(true);

    try {
      const created = await createRecipe(input);

      if (publish) {
        const published = await publishRecipe(created.id);
        router.push(`/recipes/${published.id}`);
      } else {
        router.push(`/recipes/${created.id}/edit`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.validation) {
          setServerErrors(err.validation);
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <nav className="mb-4 flex items-center gap-2 text-xs text-neutral-500">
          <Link href="/" className="hover:text-neutral-800">Home</Link>
          <span>/</span>
          <Link href="/recipes" className="hover:text-neutral-800">Recipes</Link>
          <span>/</span>
          <span className="text-neutral-800 font-medium">Create Recipe</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Create a New Recipe
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Fill in all the details to create a recipe. You can save it as a draft to publish later, or publish it immediately.
        </p>
      </div>

      <RecipeForm
        mode="create"
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitError={submitError}
        serverErrors={serverErrors}
      />
    </main>
  );
}

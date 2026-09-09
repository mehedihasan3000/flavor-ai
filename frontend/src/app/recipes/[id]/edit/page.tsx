"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError, deleteRecipe, getRecipe, publishRecipe, unpublishRecipe, updateRecipe } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { CreateRecipeInput, Recipe } from "@/lib/types";
import { Alert, Badge, Button, LoadingState, ErrorState } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { RecipeForm } from "@/components/recipes/recipe-form";
import { TrashBin } from "@gravity-ui/icons";

interface EditRecipePageProps {
  params: Promise<{ id: string }>;
}

export default function EditRecipePage({ params }: EditRecipePageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { token, isLoading: authLoading } = useAuth();
  const toast = useToast();

  // Load state
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Status action state
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);


  // Load recipe once auth has hydrated so owner drafts resolve (optionalAuth)
  useEffect(() => {
    if (authLoading) return;
    getRecipe(id, { token })
      .then((data) => {
        setRecipe(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load the recipe.");
        setIsLoading(false);
      });
  }, [id, token, authLoading]);

  // ── Form submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (input: CreateRecipeInput) => {
    setSubmitError(null);
    setServerErrors({});
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const updated = await updateRecipe(id, input, { token });
      setRecipe(updated);
      setSuccessMessage("Changes saved successfully!");
      toast.success("Changes saved successfully!", { title: "Recipe updated" });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.validation) {
          setServerErrors(err.validation);
          toast.error("Please fix the highlighted fields.", { title: "Validation failed" });
        } else {
          setSubmitError(err.message);
          toast.error(err.message, { title: "Update failed" });
        }
      } else {
        setSubmitError("An unexpected error occurred.");
        toast.error("An unexpected error occurred.", { title: "Update failed" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Status toggle ───────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!recipe) return;
    setStatusActionLoading(true);
    setSuccessMessage(null);
    setSubmitError(null);
    try {
      const updated = recipe.status === "published"
        ? await unpublishRecipe(id, { token })
        : await publishRecipe(id, { token });
      setRecipe(updated);
      const msg =
        updated.status === "published"
          ? "Recipe published and now visible to everyone."
          : "Recipe moved back to draft.";
      setSuccessMessage(msg);
      toast.success(msg, {
        title: updated.status === "published" ? "Published" : "Unpublished",
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Status change failed.";
      setSubmitError(msg);
      toast.error(msg, { title: "Update failed" });
    } finally {
      setStatusActionLoading(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setStatusActionLoading(true);
    try {
      await deleteRecipe(id, { token });
      toast.success(`"${recipe?.title ?? "Recipe"}" was deleted.`, { title: "Recipe deleted" });
      router.push("/dashboard");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Delete failed.";
      setSubmitError(msg);
      toast.error(msg, { title: "Delete failed" });
      setDeleteConfirm(false);
      setStatusActionLoading(false);
    }
  };

  // ── Render states ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <LoadingState label="Loading recipe..." />
      </main>
    );
  }

  if (loadError || !recipe) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <ErrorState
          description={loadError ?? "Recipe not found."}
          action={
            <Button type="button" variant="outline" onClick={() => router.refresh()}>
              Try Again
            </Button>
          }
        />
      </main>
    );
  }

  const isPublished = recipe.status === "published";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <nav className="mb-4 flex items-center gap-2 text-xs text-neutral-500">
          <Link href="/" className="hover:text-neutral-800">Home</Link>
          <span>/</span>
          <Link href="/recipes" className="hover:text-neutral-800">Recipes</Link>
          <span>/</span>
          <Link href={`/recipes/${id}`} className="max-w-[10rem] truncate hover:text-neutral-800">
            {recipe.title}
          </Link>
          <span>/</span>
          <span className="font-medium text-neutral-800">Edit</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Edit Recipe
            </h1>
            <p className="mt-1 max-w-xs truncate text-sm text-neutral-500 sm:max-w-lg">
              {recipe.title}
            </p>
          </div>

          {/* Status badge + actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isPublished ? "success" : "neutral"}>
              {recipe.status}
            </Badge>
            <Button
              type="button"
              variant={isPublished ? "outline" : "secondary"}
              size="sm"
              onClick={handlePublish}
              disabled={statusActionLoading || recipe.status === "hidden"}
            >
              {statusActionLoading ? "..." : isPublished ? "Unpublish" : "Publish Now"}
            </Button>
            {!deleteConfirm ? (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setDeleteConfirm(true)}
              >
                <TrashBin className="h-4 w-4" />
                <span>Delete</span>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-700">Are you sure?</span>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={handleDelete}
                  disabled={statusActionLoading}
                >
                  {statusActionLoading ? "Deleting..." : "Yes, Delete"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feedback messages */}
      {successMessage && (
        <Alert variant="success" title="Saved">
          <div className="flex items-center justify-between gap-3">
            <span>{successMessage}</span>
            {isPublished && (
              <Link
                href={`/recipes/${id}`}
                className="shrink-0 text-xs font-semibold underline hover:text-emerald-900"
              >
                View Recipe &rarr;
              </Link>
            )}
          </div>
        </Alert>
      )}

      {recipe.status === "hidden" && (
        <Alert variant="warning" title="Recipe is under moderation">
          This recipe has been hidden by an administrator and cannot be published until reviewed.
        </Alert>
      )}

      {/* Form */}
      <div className="mt-6">
        <RecipeForm
          mode="edit"
          initialData={recipe}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          submitError={submitError}
          serverErrors={serverErrors}
        />
      </div>
    </main>
  );
}

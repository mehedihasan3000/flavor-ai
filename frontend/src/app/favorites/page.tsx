"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, ChevronLeft, ChevronRight, TrashBin } from "@gravity-ui/icons";
import { AuthGuard } from "@/components/auth";
import { ApiError, listFavorites, removeFavorite } from "@/lib/api";
import type { FavoriteItem, PaginatedResult } from "@/lib/types";
import { buttonStyles, Button, EmptyState, ErrorState, LoadingState, Skeleton } from "@/components/ui";
import { RecipeCard } from "@/components/recipes/recipe-card";

const PAGE_SIZE = 12;
const SKELETON_COUNT = 6;

function FavoritesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageParam = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;

  const [result, setResult] = useState<PaginatedResult<FavoriteItem> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadFavorites = useCallback(
    (signal?: AbortSignal) => {
      return Promise.resolve()
        .then(() => {
          setIsLoading(true);
          setError(null);
        })
        .then(() => listFavorites({ page, limit: PAGE_SIZE }, { signal }))
        .then((data) => {
          setResult(data);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof ApiError ? err.message : "Failed to load favorites. Please try again.");
          setIsLoading(false);
        });
    },
    [page],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadFavorites(controller.signal);
    return () => controller.abort();
  }, [loadFavorites]);

  const goToPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const handleRemove = (recipeId: string) => {
    setRemovingId(recipeId);
    removeFavorite(recipeId)
      .then(() => {
        setResult((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.filter((item) => item.recipe.id !== recipeId),
                total: Math.max(0, prev.total - 1),
              }
            : prev,
        );
        setRemovingId(null);
      })
      .catch(() => {
        setRemovingId(null);
      });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
          Your favorites
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recipes you&apos;ve saved for later. Removed here, they&apos;re gone from this list only —
          nothing else about the recipe changes.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only" role="status">
            Loading favorites…
          </span>
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <div
              key={index}
              aria-hidden="true"
              className="space-y-3 rounded-card border border-border bg-card p-4"
            >
              <Skeleton className="aspect-video w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          description={error}
          action={
            <Button type="button" variant="outline" onClick={() => void loadFavorites()}>
              Try again
            </Button>
          }
        />
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          icon={<Bookmark aria-hidden="true" />}
          title="No favorites yet"
          description="Browse recipes and tap Favorite on the ones you want to come back to."
          action={
            <Link href="/recipes" className={buttonStyles({ variant: "primary", size: "sm" })}>
              Browse recipes
            </Link>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-xs text-muted-foreground">
            {result.total} favorite{result.total === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((item) => (
              <div key={item.id} className="relative">
                <RecipeCard recipe={item.recipe} />
                <button
                  type="button"
                  onClick={() => handleRemove(item.recipe.id)}
                  disabled={removingId === item.recipe.id}
                  aria-label={`Remove ${item.recipe.title} from favorites`}
                  className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-card/90 text-danger-strong shadow-sm backdrop-blur-sm transition-colors hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <TrashBin className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          {result.totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Favorites pages">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Previous
              </Button>
              <span className="px-2 text-xs font-medium text-muted-foreground">
                Page {result.page} of {result.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= result.totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}

export default function FavoritesPage() {
  return (
    <AuthGuard message="Sign in to view and manage the recipes you've favorited.">
      <Suspense
        fallback={
          <main className="mx-auto max-w-6xl px-4 py-16">
            <LoadingState label="Loading favorites…" />
          </main>
        }
      >
        <FavoritesContent />
      </Suspense>
    </AuthGuard>
  );
}

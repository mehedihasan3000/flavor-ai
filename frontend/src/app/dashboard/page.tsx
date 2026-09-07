"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Comment,
  Sparkles,
  Star,
} from "@gravity-ui/icons";
import { AuthGuard } from "@/components/auth";
import { ApiError, getMyStats, listRecipes } from "@/lib/api";
import type { DashboardStats, PaginatedResult, Recipe, RecipeStatus } from "@/lib/types";
import { buttonStyles, Button, Card, EmptyState, ErrorState, LoadingState, Skeleton } from "@/components/ui";
import { RecipeCard } from "@/components/recipes/recipe-card";

const PAGE_SIZE = 9;
const SKELETON_COUNT = 6;

const TABS: ReadonlyArray<{ value: RecipeStatus | ""; label: string }> = [
  { value: "", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "hidden", label: "Hidden" },
];

function isRecipeStatus(value: string): value is RecipeStatus {
  return value === "draft" || value === "published" || value === "hidden";
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-extrabold tracking-tight text-heading">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
    </Card>
  );
}

function DashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusParam = searchParams.get("status") ?? "";
  const status = isRecipeStatus(statusParam) ? statusParam : "";
  const pageParam = Number(searchParams.get("page") ?? "1");
  const page = Number.isFinite(pageParam) && pageParam >= 1 ? pageParam : 1;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [result, setResult] = useState<PaginatedResult<Recipe> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(
    (signal?: AbortSignal) => {
      return Promise.resolve()
        .then(() => {
          setIsLoading(true);
          setError(null);
          setStatsError(null);
        })
        .then(() =>
          Promise.allSettled([
            getMyStats({ signal }),
            listRecipes({ mine: true, status: status || undefined, page, limit: PAGE_SIZE }, { signal }),
          ]),
        )
        .then(([statsResult, recipesResult]) => {
          if (statsResult.status === "fulfilled") {
            setStats(statsResult.value);
          } else if (!(statsResult.reason instanceof DOMException)) {
            setStatsError("Couldn't load your stats.");
          }

          if (recipesResult.status === "fulfilled") {
            setResult(recipesResult.value);
            setIsLoading(false);
          } else {
            const err = recipesResult.reason;
            if (err instanceof DOMException && err.name === "AbortError") return;
            setError(err instanceof ApiError ? err.message : "Failed to load your recipes. Please try again.");
            setIsLoading(false);
          }
        });
    },
    [status, page],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard]);

  const goToTab = (nextStatus: RecipeStatus | "") => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextStatus) params.set("status", nextStatus);
    else params.delete("status");
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const goToPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
            Your dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your drafts and published recipes, and see how the community responded.
          </p>
        </div>
        <Link href="/recipes/create" className={buttonStyles({ variant: "primary", size: "sm" })}>
          <CirclePlus className="size-4" aria-hidden="true" />
          New recipe
        </Link>
      </div>

      {statsError && (
        <p className="mb-4 text-xs font-medium text-danger-strong">{statsError}</p>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats ? (
          <>
            <StatTile label="Published" value={stats.publishedCount} />
            <StatTile label="Drafts" value={stats.draftCount} />
            <StatTile
              label="Avg. rating"
              value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
            />
            <StatTile label="Favorited by" value={stats.totalFavoritesReceived} />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-18" />)
        )}
      </div>

      {stats && (
        <div className="mb-8 flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Star className="size-3.5 text-amber-500" aria-hidden="true" />
            {stats.totalRatingsReceived} ratings received
          </span>
          <span className="flex items-center gap-1.5">
            <Bookmark className="size-3.5" aria-hidden="true" />
            {stats.totalFavoritesReceived} favorites received
          </span>
          <span className="flex items-center gap-1.5">
            <Comment className="size-3.5" aria-hidden="true" />
            {stats.totalCommentsReceived} comments received
          </span>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3" role="tablist" aria-label="Filter by status">
        {TABS.map((tab) => (
          <button
            key={tab.value || "all"}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => goToTab(tab.value)}
            className={`rounded-button px-3 py-1.5 text-sm font-medium transition-colors ${
              status === tab.value
                ? "bg-primary-soft text-primary-strong"
                : "text-muted-foreground hover:bg-background hover:text-heading"
            }`}
          >
            {tab.label}
            {stats && tab.value !== "" && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                (
                {tab.value === "published"
                  ? stats.publishedCount
                  : tab.value === "draft"
                    ? stats.draftCount
                    : stats.hiddenCount}
                )
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only" role="status">
            Loading your recipes…
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
            <Button type="button" variant="outline" onClick={() => void loadDashboard()}>
              Try again
            </Button>
          }
        />
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          icon={<Sparkles aria-hidden="true" />}
          title={status ? `No ${status} recipes` : "No recipes yet"}
          description={
            status
              ? `You don't have any ${status} recipes right now.`
              : "Create your first recipe manually, or generate one with AI."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/recipes/create" className={buttonStyles({ variant: "primary", size: "sm" })}>
                Create a recipe
              </Link>
              <Link href="/generator" className={buttonStyles({ variant: "outline", size: "sm" })}>
                Try the AI generator
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-xs text-muted-foreground">
            {result.total} recipe{result.total === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>

          {result.totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Your recipes pages">
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

export default function DashboardPage() {
  return (
    <AuthGuard message="Sign in to view your dashboard, drafts, and recipe stats.">
      <Suspense
        fallback={
          <main className="mx-auto max-w-6xl px-4 py-16">
            <LoadingState label="Loading your dashboard…" />
          </main>
        }
      >
        <DashboardContent />
      </Suspense>
    </AuthGuard>
  );
}

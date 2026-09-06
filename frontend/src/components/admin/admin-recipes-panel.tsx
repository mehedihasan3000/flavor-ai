"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError, adminDeleteRecipe, adminListRecipes, adminModerateRecipe } from "@/lib/api";
import type { AdminRecipe, PaginatedResult, RecipeStatus } from "@/lib/types";
import { formatEnumLabel } from "@/lib/format";
import { Badge, Button, EmptyState, ErrorState, Input, LoadingState, Pagination, Select } from "@/components/ui";

const PAGE_SIZE = 20;

const STATUS_BADGE_VARIANT: Record<RecipeStatus, "success" | "warning" | "neutral"> = {
  published: "success",
  draft: "warning",
  hidden: "neutral",
};

export function AdminRecipesPanel() {
  const { token } = useAuth();

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RecipeStatus | "">("");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<PaginatedResult<AdminRecipe> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actioningId, setActioningId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      return Promise.resolve()
        .then(() => {
          setIsLoading(true);
          setError(null);
        })
        .then(() =>
          adminListRecipes(
            { q: q || undefined, status: status || undefined, page, limit: PAGE_SIZE },
            { token, signal },
          ),
        )
        .then((data) => {
          setResult(data);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof ApiError ? err.message : "Failed to load recipes. Please try again.");
          setIsLoading(false);
        });
    },
    [q, status, page, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQ(qInput.trim());
  };

  const handleToggleStatus = (recipe: AdminRecipe) => {
    const nextStatus = recipe.status === "published" ? "hidden" : "published";
    setActioningId(recipe.id);
    setActionError(null);
    adminModerateRecipe(recipe.id, nextStatus, { token })
      .then((updated) => {
        setResult((prev) =>
          prev ? { ...prev, items: prev.items.map((r) => (r.id === updated.id ? updated : r)) } : prev,
        );
        setActioningId(null);
      })
      .catch((err: unknown) => {
        setActionError(err instanceof ApiError ? err.message : "Action failed. Please try again.");
        setActioningId(null);
      });
  };

  const handleDelete = (recipeId: string) => {
    setActioningId(recipeId);
    setActionError(null);
    adminDeleteRecipe(recipeId, { token })
      .then(() => {
        setResult((prev) =>
          prev
            ? { ...prev, items: prev.items.filter((r) => r.id !== recipeId), total: Math.max(0, prev.total - 1) }
            : prev,
        );
        setActioningId(null);
        setConfirmingDeleteId(null);
      })
      .catch((err: unknown) => {
        setActionError(err instanceof ApiError ? err.message : "Failed to delete recipe. Please try again.");
        setActioningId(null);
        setConfirmingDeleteId(null);
      });
  };

  return (
    <div>
      <form onSubmit={handleSearchSubmit} className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 min-w-0">
          <Input
            type="search"
            value={qInput}
            onChange={(event) => setQInput(event.target.value)}
            placeholder="Search by title…"
            aria-label="Search recipes"
          />
        </div>
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as RecipeStatus | "");
            setPage(1);
          }}
          className="sm:w-40 shrink-0"
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="hidden">Hidden</option>
        </Select>
        <Button type="submit" className="shrink-0">
          Search
        </Button>
      </form>

      {actionError && <p className="mb-3 text-xs font-medium text-danger-strong">{actionError}</p>}

      {isLoading ? (
        <LoadingState label="Loading recipes…" />
      ) : error ? (
        <ErrorState
          description={error}
          action={
            <Button type="button" variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : !result || result.items.length === 0 ? (
        <EmptyState title="No recipes found" description="Try a different search or status filter." />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{result.total} recipes</p>
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-background text-xs font-semibold text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5">Title</th>
                  <th scope="col" className="px-4 py-2.5">Status</th>
                  <th scope="col" className="px-4 py-2.5">Rating</th>
                  <th scope="col" className="px-4 py-2.5">Favorites</th>
                  <th scope="col" className="px-4 py-2.5">Comments</th>
                  <th scope="col" className="px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((recipe) => {
                  const isBusy = actioningId === recipe.id;
                  const isConfirming = confirmingDeleteId === recipe.id;
                  return (
                    <tr key={recipe.id} className="border-b border-border last:border-0">
                      <td className="max-w-[260px] px-4 py-2.5">
                        <Link
                          href={`/recipes/${recipe.id}`}
                          className="line-clamp-1 font-medium text-heading hover:text-primary-strong hover:underline"
                        >
                          {recipe.title}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={STATUS_BADGE_VARIANT[recipe.status]}>
                          {formatEnumLabel(recipe.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {recipe.averageRating > 0 ? recipe.averageRating.toFixed(1) : "—"} ({recipe.ratingCount})
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{recipe.favoriteCount}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{recipe.commentCount}</td>
                      <td className="px-4 py-2.5">
                        {isConfirming ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Delete?</span>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(recipe.id)}
                              className="font-semibold text-danger-strong hover:underline disabled:opacity-50"
                            >
                              {isBusy ? "Deleting…" : "Confirm"}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmingDeleteId(null)}
                              className="font-medium text-muted-foreground hover:underline disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            {recipe.status !== "draft" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                loading={isBusy}
                                onClick={() => handleToggleStatus(recipe)}
                              >
                                {recipe.status === "published" ? "Hide" : "Restore"}
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              disabled={isBusy}
                              onClick={() => setConfirmingDeleteId(recipe.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={result.page} totalPages={result.totalPages} onChange={setPage} label="Recipes pages" />
        </>
      )}
    </div>
  );
}

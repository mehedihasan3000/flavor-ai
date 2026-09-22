"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrashBin, Xmark } from "@gravity-ui/icons";
import { AuthGuard } from "@/components/auth";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
} from "@/components/ui";
import {
  ApiError,
  createMealPlan,
  deleteMealPlan,
  listMealPlans,
  updateMealPlan,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { CreateMealPlanInput, MealPlan, PaginatedResult } from "@/lib/types";

const PAGE_SIZE = 20;

type Tab = "all" | "archived";

function formatRange(start: string, end: string): string {
  const fmt = (ymd: string) =>
    new Date(`${ymd}T00:00:00Z`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

function validateCreateForm(name: string, start: string, end: string): string | null {
  if (name.trim().length > 120) return "Plan name must be at most 120 characters.";
  if (!start) return "Week start date is required.";
  if (!end) return "Week end date is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return "Dates must use YYYY-MM-DD format.";
  }
  if (end <= start) return "Week end date must be after the start date.";
  return null;
}

function MealPlanListContent() {
  const { token } = useAuth();
  const router = useRouter();

  const [result, setResult] = useState<PaginatedResult<MealPlan> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!token) {
        return Promise.resolve().then(() => {
          setIsLoading(false);
        });
      }
      return Promise.resolve()
        .then(() => {
          setIsLoading(true);
          setError(null);
        })
        .then(() =>
          listMealPlans(
            {
              page,
              limit: PAGE_SIZE,
              ...(tab === "archived" ? { status: "archived" as const } : {}),
              ...(favoritesOnly ? { isFavorite: true } : {}),
            },
            { token, signal },
          ),
        )
        .then((data) => {
          setResult(data);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(
            err instanceof ApiError ? err.message : "Failed to load meal plans. Please try again.",
          );
          setIsLoading(false);
        });
    },
    [token, page, tab, favoritesOnly],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const openCreate = () => {
    setName("");
    setWeekStart("");
    setWeekEnd("");
    setFormError(null);
    setFormOpen(true);
  };

  const handleCreate = () => {
    const validation = validateCreateForm(name, weekStart, weekEnd);
    if (validation) {
      setFormError(validation);
      return;
    }
    setSaving(true);
    setFormError(null);
    setActionError(null);
    const payload: CreateMealPlanInput = {
      ...(name.trim() ? { name: name.trim() } : {}),
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
    };
    createMealPlan(payload, { token })
      .then((plan) => {
        setSaving(false);
        setFormOpen(false);
        router.push(`/meal-plan/${plan.id}`);
      })
      .catch((err: unknown) => {
        setFormError(
          err instanceof ApiError ? err.message : "Could not create the plan. Please try again.",
        );
        setSaving(false);
      });
  };

  const handleToggleFavorite = (plan: MealPlan) => {
    setBusyId(plan.id);
    setActionError(null);
    updateMealPlan(plan.id, { isFavorite: !plan.isFavorite }, { token })
      .then(() => {
        setBusyId(null);
        void load();
      })
      .catch((err: unknown) => {
        setBusyId(null);
        setActionError(
          err instanceof ApiError ? err.message : "Could not update the plan. Please try again.",
        );
      });
  };

  const handleToggleArchive = (plan: MealPlan) => {
    setBusyId(plan.id);
    setActionError(null);
    updateMealPlan(plan.id, { status: plan.status === "archived" ? "active" : "archived" }, { token })
      .then(() => {
        setBusyId(null);
        void load();
      })
      .catch((err: unknown) => {
        setBusyId(null);
        setActionError(
          err instanceof ApiError ? err.message : "Could not update the plan. Please try again.",
        );
      });
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setBusyId(id);
    setActionError(null);
    deleteMealPlan(id, { token })
      .then(() => {
        setBusyId(null);
        setConfirmDeleteId(null);
        void load();
      })
      .catch((err: unknown) => {
        setBusyId(null);
        setActionError(
          err instanceof ApiError ? err.message : "Could not delete the plan. Please try again.",
        );
      });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
            Meal Plans
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan your week manually or generate it with AI, then turn it into a grocery list.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          New plan
        </Button>
      </div>

      {actionError && (
        <Alert variant="danger" title="Something went wrong">
          <div className="flex items-start justify-between gap-3">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              aria-label="Dismiss error"
              className="shrink-0 text-xs font-semibold underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      )}

      <Card className="flex flex-wrap items-center gap-2 p-4 sm:p-5">
        <div role="tablist" aria-label="Filter by status" className="flex gap-2">
          {(["all", "archived"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={tab === value ? undefined : "outline"}
              onClick={() => {
                setTab(value);
                setPage(1);
              }}
            >
              {value === "all" ? "All" : "Archived"}
            </Button>
          ))}
        </div>
        <Checkbox
          id="mealplan-favorites"
          label="Favorites only"
          checked={favoritesOnly}
          onChange={(e) => {
            setFavoritesOnly(e.target.checked);
            setPage(1);
          }}
        />
      </Card>

      {isLoading ? (
        <LoadingState label="Loading your meal plans…" />
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
        <EmptyState
          title="No meal plans yet"
          description={
            favoritesOnly
              ? "You have no favorite plans. Tap the star on any plan to save it here for reuse."
              : "Create your first weekly plan manually, or generate one with AI on the plan page."
          }
          action={
            <Button type="button" onClick={openCreate}>
              Create your first plan
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {result.total} plan{result.total === 1 ? "" : "s"}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((plan) => (
              <li key={plan.id}>
                <Card className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-heading">{plan.name}</p>
                      <p className="mt-0.5 text-sm text-subtle-foreground">
                        {formatRange(plan.weekStartDate, plan.weekEndDate)} · {plan.meals.length}{" "}
                        meal{plan.meals.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {plan.isFavorite && (
                        <Badge variant="primary" title="Saved as a favorite plan">
                          Favorite
                        </Badge>
                      )}
                      <Badge variant={plan.status === "archived" ? "neutral" : "success"}>
                        {plan.status === "archived" ? "Archived" : "Active"}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push(`/meal-plan/${plan.id}`)}
                    >
                      Open
                    </Button>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(plan)}
                      disabled={busyId === plan.id}
                      aria-label={plan.isFavorite ? `Remove ${plan.name} from favorites` : `Save ${plan.name} as a favorite`}
                      aria-pressed={plan.isFavorite}
                      className="flex h-9 items-center gap-1 rounded-button px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-heading disabled:opacity-55"
                    >
                      <span aria-hidden="true">{plan.isFavorite ? "★" : "☆"}</span>
                      {plan.isFavorite ? "Favorited" : "Favorite"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleArchive(plan)}
                      disabled={busyId === plan.id}
                      className="flex h-9 items-center rounded-button px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-heading disabled:opacity-55"
                    >
                      {plan.status === "archived" ? "Unarchive" : "Archive"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(plan.id)}
                      disabled={busyId === plan.id}
                      aria-label={
                        confirmDeleteId === plan.id
                          ? `Confirm deletion of ${plan.name}`
                          : `Delete ${plan.name}`
                      }
                      className={`flex size-9 items-center justify-center rounded-button transition-colors disabled:opacity-55 ${
                        confirmDeleteId === plan.id
                          ? "bg-danger-bg font-semibold text-danger-strong"
                          : "text-muted-foreground hover:bg-background hover:text-danger-strong"
                      }`}
                    >
                      <TrashBin className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          {result.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {result.page} of {result.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={page >= result.totalPages}
                onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (!saving) setFormOpen(false);
          }}
        >
          <Card
            role="dialog"
            aria-modal="true"
            aria-label="Create meal plan"
            className="w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-heading">New meal plan</h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                disabled={saving}
                aria-label="Close dialog"
                className="flex size-9 items-center justify-center rounded-button text-muted-foreground hover:bg-background hover:text-heading"
              >
                <Xmark className="size-4" aria-hidden="true" />
              </button>
            </div>
            {formError && (
              <div className="mt-4">
                <Alert variant="danger">{formError}</Alert>
              </div>
            )}
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
            >
              <Input
                label="Plan name (optional)"
                maxLength={120}
                placeholder="My Week"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Week start"
                  type="date"
                  required
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  disabled={saving}
                />
                <Input
                  label="Week end"
                  type="date"
                  required
                  value={weekEnd}
                  onChange={(e) => setWeekEnd(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Creating…" : "Create plan"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </main>
  );
}

export default function MealPlanListPage() {
  return (
    <AuthGuard message="Sign in to manage your meal plans.">
      <MealPlanListContent />
    </AuthGuard>
  );
}

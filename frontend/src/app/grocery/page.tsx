"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ArrowRotateRight, ListCheck, Calendar } from "@gravity-ui/icons";
import { AuthGuard } from "@/components/auth";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
} from "@/components/ui";
import {
  ApiError,
  generateGroceryList,
  listGroceryLists,
  updateGroceryList,
} from "@/lib/api";
import type { GroceryList, GroceryListStatus } from "@/lib/types";

function GroceryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = searchParams.get("plan");

  const [lists, setLists] = useState<GroceryList[]>([]);
  const [statusFilter, setStatusFilter] = useState<GroceryListStatus | "all">("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Generate Modal / Form state
  const [showGenerateModal, setShowGenerateModal] = useState(Boolean(planParam));
  const [mealPlanIdInput, setMealPlanIdInput] = useState(planParam || "");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const fetchLists = useCallback(() => {
    Promise.resolve()
      .then(() => {
        setLoading(true);
        setError(null);
      })
      .then(() =>
        listGroceryLists({
          status: statusFilter === "all" ? undefined : statusFilter,
          limit: 50,
        }),
      )
      .then((res) => {
        setLists(res.items);
      })
      .catch((err) => {
        const msg = err instanceof ApiError ? err.message : "Failed to load grocery lists.";
        setError(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [statusFilter]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealPlanIdInput.trim()) {
      setGenerateError("Please enter a valid Meal Plan ID.");
      return;
    }

    setGenerating(true);
    setGenerateError(null);
    try {
      const newList = await generateGroceryList({ mealPlanId: mealPlanIdInput.trim() });
      setShowGenerateModal(false);
      setMealPlanIdInput("");
      router.push(`/grocery/${newList._id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to generate grocery list.";
      setGenerateError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleArchive = async (list: GroceryList, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus: GroceryListStatus = list.status === "active" ? "archived" : "active";
    try {
      await updateGroceryList(list._id, { status: newStatus });
      fetchLists();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to update list status.";
      setError(msg);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
            Smart Grocery Lists
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consolidated ingredient checklists generated from your meal plans & custom additions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowGenerateModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-lg shadow-emerald-950/20"
          >
            <Plus className="w-4 h-4" />
            Generate List from Meal Plan
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border border-border/30">
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              statusFilter === "active"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active Lists
          </button>
          <button
            onClick={() => setStatusFilter("archived")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              statusFilter === "archived"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Archived History
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              statusFilter === "all"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLists}
          className="gap-2 border-border/40 hover:bg-muted/40"
        >
          <ArrowRotateRight className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Modal for Generation */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border/60 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-border/40 pb-3">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <ListCheck className="w-5 h-5 text-emerald-400" />
                Generate Grocery List
              </h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              Provide a Meal Plan ID to aggregate recipe requirements, scale servings, and subtract your active pantry inventory automatically.
            </p>

            {generateError && <Alert variant="danger">{generateError}</Alert>}

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Meal Plan ID
                </label>
                <Input
                  value={mealPlanIdInput}
                  onChange={(e) => setMealPlanIdInput(e.target.value)}
                  placeholder="e.g. 64f1a2b3c4d5e6f7a8b9c0d1"
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowGenerateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={generating}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {generating ? "Calculating..." : "Generate List"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content */}
      {error && (
        <ErrorState
          title="Error Loading Grocery Lists"
          description={error}
          action={
            <Button variant="outline" onClick={fetchLists}>
              Retry
            </Button>
          }
        />
      )}

      {loading ? (
        <LoadingState label="Loading your grocery lists..." />
      ) : lists.length === 0 ? (
        <EmptyState
          title="No Grocery Lists Found"
          description="Generate a new grocery list from one of your active meal plans to start shopping smart."
          action={
            <Button
              onClick={() => setShowGenerateModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              Generate Grocery List
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lists.map((list) => {
            const purchasedCount = list.items.filter((i) => i.isPurchased).length;
            const progress = list.items.length > 0 ? Math.round((purchasedCount / list.items.length) * 100) : 0;

            return (
              <Card
                key={list._id}
                onClick={() => router.push(`/grocery/${list._id}`)}
                className="group relative cursor-pointer border-border/40 hover:border-emerald-500/40 bg-card/60 backdrop-blur-md p-6 rounded-2xl transition-all duration-200 hover:shadow-xl hover:shadow-emerald-950/10 space-y-4"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground group-hover:text-emerald-400 transition-colors line-clamp-1">
                      {list.name}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(list.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge
                    variant={list.status === "active" ? "success" : "neutral"}
                    className="capitalize text-xs font-semibold"
                  >
                    {list.status}
                  </Badge>
                </div>

                {/* Progress bar & counts */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground font-medium">
                    <span>{purchasedCount} of {list.items.length} items purchased</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Footer details */}
                <div className="flex justify-between items-center text-xs text-muted-foreground border-t border-border/30 pt-3">
                  {list.budget !== null && list.budget !== undefined ? (
                    <span className="font-medium text-emerald-400/90">
                      Target items: {list.budget}
                    </span>
                  ) : (
                    <span>No budget cap set</span>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleToggleArchive(list, e)}
                    className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                  >
                    {list.status === "active" ? "Archive" : "Unarchive"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GroceryPage() {
  return (
    <AuthGuard>
      <Suspense fallback={<LoadingState label="Loading grocery app..." />}>
        <GroceryPageContent />
      </Suspense>
    </AuthGuard>
  );
}

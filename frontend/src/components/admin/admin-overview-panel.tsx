"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, adminGetOverview } from "@/lib/api";
import type { AdminOverviewData, AdminOverviewRange } from "@/lib/types";
import { Badge, Button, Card, ErrorState, LoadingState, Select, Skeleton } from "@/components/ui";
import { OverviewCharts } from "./overview-charts";
import { TopListsTables } from "./top-lists-tables";
import { ActivityFeeds } from "./activity-feeds";

export function AdminOverviewPanel() {
  const { token } = useAuth();
  const [range, setRange] = useState<AdminOverviewRange>("30d");
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      return Promise.resolve()
        .then(() => {
          setIsLoading(true);
          setError(null);
        })
        .then(() => adminGetOverview(range, { token, signal }))
        .then((result) => {
          setData(result);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(
            err instanceof ApiError
              ? err.message
              : "Failed to load overview data. Please try again.",
          );
          setIsLoading(false);
        });
    },
    [range, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="mb-1 h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </Card>
          ))}
        </div>
        <LoadingState label="Loading overview metrics…" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <ErrorState
        description={error}
        action={
          <Button type="button" variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        }
      />
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-6">
      {/* Header & Range Selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-heading">System & Moderation Overview</h2>
          <p className="text-xs text-muted-foreground">
            Platform performance metrics, moderation queue status, and AI system health.
          </p>
        </div>
        <div className="w-full sm:w-40 sm:shrink-0">
          <Select
            aria-label="Select time range"
            value={range}
            onChange={(e) => setRange(e.target.value as AdminOverviewRange)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </Select>
        </div>
      </div>

      {/* KPI Cards Grid: 1 col mobile, 2 tablet, 4 desktop */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Users */}
        <Card className="p-4 transition-colors hover:border-border-strong">
          <p className="text-xs font-medium text-muted-foreground">Total Users</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-heading">
              {kpis?.totalUsers.toLocaleString() ?? 0}
            </span>
            <Badge variant="neutral" className="text-xs">
              {kpis?.userRoles.admin ?? 0} Admins
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {kpis?.userRoles.user.toLocaleString() ?? 0} standard users
          </p>
        </Card>

        {/* Card 2: Total Recipes */}
        <Card className="p-4 transition-colors hover:border-border-strong">
          <p className="text-xs font-medium text-muted-foreground">Total Recipes</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-heading">
              {kpis?.totalRecipes.toLocaleString() ?? 0}
            </span>
            <Badge variant="success" className="text-xs">
              {kpis?.recipeStatus.published ?? 0} Published
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {kpis?.recipeStatus.draft ?? 0} drafts · {kpis?.recipeStatus.hidden ?? 0} hidden
          </p>
        </Card>

        {/* Card 3: Recipe Sources */}
        <Card className="p-4 transition-colors hover:border-border-strong">
          <p className="text-xs font-medium text-muted-foreground">Recipe Sources</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-heading">
              {kpis?.recipeSource.ai.toLocaleString() ?? 0}
            </span>
            <Badge variant="primary" className="text-xs">
              AI Generated
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {kpis?.recipeSource.manual.toLocaleString() ?? 0} manually created
          </p>
        </Card>

        {/* Card 4: Pending Moderation */}
        <Card className="p-4 transition-colors hover:border-border-strong">
          <p className="text-xs font-medium text-muted-foreground">Pending Moderation</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-danger-strong">
              {kpis?.pendingModeration.total ?? 0}
            </span>
            <Badge
              variant={(kpis?.pendingModeration.total ?? 0) > 0 ? "danger" : "neutral"}
              className="text-xs"
            >
              Needs Review
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {kpis?.pendingModeration.hiddenRecipes ?? 0} recipes · {kpis?.pendingModeration.moderatedComments ?? 0} comments
          </p>
        </Card>

        {/* Card 5: Total Comments */}
        <Card className="p-4 transition-colors hover:border-border-strong">
          <p className="text-xs font-medium text-muted-foreground">Total Comments</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-heading">
              {kpis?.totalComments.toLocaleString() ?? 0}
            </span>
            <Badge variant="neutral" className="text-xs">
              Community
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Posted across all recipes</p>
        </Card>

        {/* Card 6: Total Favorites */}
        <Card className="p-4 transition-colors hover:border-border-strong">
          <p className="text-xs font-medium text-muted-foreground">Total Favorites</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-heading">
              {kpis?.totalFavorites.toLocaleString() ?? 0}
            </span>
            <Badge variant="warning" className="text-xs">
              Bookmarked
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Saved user recipes</p>
        </Card>

        {/* Card 7: Platform Avg Rating */}
        <Card className="p-4 transition-colors hover:border-border-strong">
          <p className="text-xs font-medium text-muted-foreground">Platform Avg Rating</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-heading">
              {kpis?.platformAverageRating ? kpis.platformAverageRating.toFixed(2) : "0.00"}
            </span>
            <Badge variant="warning" className="text-xs">
              ★ Score
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Across rated published recipes</p>
        </Card>

        {/* Card 8: AI Health */}
        <Card className="p-4 transition-colors hover:border-border-strong">
          <p className="text-xs font-medium text-muted-foreground">AI Health Rate</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-primary-strong">
              {kpis?.aiMetrics.successRate ?? 100}%
            </span>
            <Badge variant="success" className="text-xs">
              {kpis?.aiMetrics.averageLatencyMs ?? 0}ms avg
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {kpis?.aiMetrics.total.toLocaleString() ?? 0} total AI generation requests
          </p>
        </Card>
      </div>

      {/* Subcomponents for Charts, Top Lists, and Feeds (Commit 9) */}
      {data && (
        <>
          <OverviewCharts trends={data.trends} aiHealth={data.aiHealth} range={data.range} />
          <TopListsTables topLists={data.topLists} />
          <ActivityFeeds feeds={data.feeds} />
        </>
      )}
    </div>
  );
}

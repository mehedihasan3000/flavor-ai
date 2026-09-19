"use client";

import type { AdminOverviewFeeds } from "@/lib/types";
import { Badge, Card, EmptyState } from "@/components/ui";

interface ActivityFeedsProps {
  feeds: AdminOverviewFeeds;
}

function getActivityBadge(type: "user_registered" | "recipe_published" | "comment_moderated") {
  switch (type) {
    case "user_registered":
      return <Badge variant="neutral">New User</Badge>;
    case "recipe_published":
      return <Badge variant="success">Published</Badge>;
    case "comment_moderated":
      return <Badge variant="danger">Moderated</Badge>;
  }
}

function getErrorBadge(category: string | null) {
  switch (category) {
    case "timeout":
      return <Badge variant="warning">Timeout</Badge>;
    case "rate_limit":
      return <Badge variant="warning">Rate Limited</Badge>;
    case "invalid_output":
      return <Badge variant="danger">Invalid Output</Badge>;
    case "provider_error":
      return <Badge variant="danger">Provider Error</Badge>;
    default:
      return <Badge variant="neutral">{category ?? "Failed"}</Badge>;
  }
}

export function ActivityFeeds({ feeds }: ActivityFeedsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Latest Platform Activity Feed */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-heading">Latest Platform Activity</h3>
          <p className="text-xs text-muted-foreground">Recent user signups, recipe publications & comment actions</p>
        </div>
        {feeds.latestActivity.length === 0 ? (
          <EmptyState title="No recent activity" description="Platform activities will appear here." />
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border">
            {feeds.latestActivity.map((item) => (
              <li key={`${item.type}-${item.id}`} className="flex items-center justify-between p-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {getActivityBadge(item.type)}
                  <span className="truncate font-medium text-heading">{item.title}</span>
                </div>
                <span className="shrink-0 text-muted-foreground">
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Recent AI Failures Feed */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-heading">Recent AI Failure Logs</h3>
          <p className="text-xs text-muted-foreground">Recent failed AI generation calls & errors (raw input hidden)</p>
        </div>
        {feeds.recentAiFailures.length === 0 ? (
          <EmptyState title="No AI failures" description="All recent AI calls completed successfully." />
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border">
            {feeds.recentAiFailures.map((log) => (
              <li key={log.id} className="flex items-center justify-between p-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {getErrorBadge(log.errorCategory)}
                  <span className="truncate font-mono text-muted-foreground">{log.model}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                  <span>{log.latencyMs}ms</span>
                  <span>
                    {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminOverviewAiHealth, AdminOverviewRange, AdminOverviewTrends } from "@/lib/types";
import { Card, EmptyState } from "@/components/ui";

interface OverviewChartsProps {
  trends: AdminOverviewTrends;
  aiHealth: AdminOverviewAiHealth;
  range: AdminOverviewRange;
}

export function OverviewCharts({ trends, aiHealth, range }: OverviewChartsProps) {
  const rangeLabel = range === "7d" ? "7 days" : range === "90d" ? "90 days" : "30 days";

  const aiHealthData = [
    { name: "Success", count: aiHealth.success, fill: "var(--color-success-strong, #10b981)" },
    { name: "Failed", count: aiHealth.failed, fill: "var(--color-danger-strong, #ef4444)" },
    { name: "Timeout", count: aiHealth.timeout, fill: "var(--color-warning-strong, #f59e0b)" },
  ];

  return (
    <div className="space-y-6">
      {/* Trends Grid: User Growth & Recipe Creation (Stack on mobile, 2 cols on desktop) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* User Growth Trend Chart */}
        <Card className="p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-heading">User Growth Trend</h3>
            <p className="text-xs text-muted-foreground">
              New user registrations over the last {rangeLabel}
            </p>
          </div>
          {trends.userGrowth.length === 0 ? (
            <EmptyState title="No trend data" description="No user registrations recorded." />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends.userGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="userGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff6b00" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ff6b00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border, #e5e7eb)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val: string) => val.slice(5)}
                    stroke="var(--color-muted-foreground, #6b7280)"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground, #6b7280)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card, #ffffff)",
                      borderColor: "var(--color-border, #e5e7eb)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Signups"
                    stroke="#ff6b00"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#userGrowthGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Recipe Creation Trend Chart */}
        <Card className="p-4 sm:p-5">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-heading">Recipe Creation Trend</h3>
            <p className="text-xs text-muted-foreground">
              Recipes created over the last {rangeLabel}
            </p>
          </div>
          {trends.recipeCreation.length === 0 ? (
            <EmptyState title="No trend data" description="No recipes created." />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends.recipeCreation} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="recipeCreationGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border, #e5e7eb)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val: string) => val.slice(5)}
                    stroke="var(--color-muted-foreground, #6b7280)"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground, #6b7280)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card, #ffffff)",
                      borderColor: "var(--color-border, #e5e7eb)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Recipes"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#recipeCreationGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* AI Health Breakdown Bar Chart */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-heading">AI Generation Call Outcomes</h3>
          <p className="text-xs text-muted-foreground">
            Distribution of successful calls vs failures and timeouts in the last {rangeLabel}
          </p>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={aiHealthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border, #e5e7eb)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground, #6b7280)" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground, #6b7280)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card, #ffffff)",
                  borderColor: "var(--color-border, #e5e7eb)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" name="Calls" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

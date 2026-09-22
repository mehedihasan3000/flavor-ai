"use client";

import Link from "next/link";
import type { AdminOverviewTopLists } from "@/lib/types";
import { Badge, Card, EmptyState } from "@/components/ui";

interface TopListsTablesProps {
  topLists: AdminOverviewTopLists;
}

export function TopListsTables({ topLists }: TopListsTablesProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Top 5 Recipes */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-heading">Top 5 Published Recipes</h3>
          <p className="text-xs text-muted-foreground">Highest average rating and bookmark count</p>
        </div>
        {topLists.topRecipes.length === 0 ? (
          <EmptyState title="No published recipes" description="Published recipes will appear here." />
        ) : (
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-background text-xs font-semibold text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">Title</th>
                  <th scope="col" className="px-3 py-2 text-right">Rating</th>
                  <th scope="col" className="px-3 py-2 text-right">Favorites</th>
                </tr>
              </thead>
              <tbody>
                {topLists.topRecipes.map((recipe) => (
                  <tr key={recipe.id} className="border-b border-border last:border-0">
                    <td className="max-w-[200px] px-3 py-2">
                      <Link
                        href={`/recipes/${recipe.id}`}
                        className="line-clamp-1 font-medium text-heading hover:text-primary-strong hover:underline"
                      >
                        {recipe.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-heading">
                      ★ {recipe.averageRating > 0 ? recipe.averageRating.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {recipe.favoriteCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Top 5 Creators */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-heading">Top 5 Recipe Creators</h3>
          <p className="text-xs text-muted-foreground">Most active authors by recipe count</p>
        </div>
        {topLists.topCreators.length === 0 ? (
          <EmptyState title="No creators" description="Recipe creators will appear here." />
        ) : (
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-background text-xs font-semibold text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">Author Name</th>
                  <th scope="col" className="px-3 py-2 text-right">Recipes Created</th>
                </tr>
              </thead>
              <tbody>
                {topLists.topCreators.map((creator) => (
                  <tr key={creator.userId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium text-heading">{creator.name}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant="primary" className="font-semibold">
                        {creator.recipeCount} recipes
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth";
import { LoadingState } from "@/components/ui";
import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import { AdminRecipesPanel } from "@/components/admin/admin-recipes-panel";
import { AdminCommentsPanel } from "@/components/admin/admin-comments-panel";

type AdminTab = "recipes" | "comments" | "users";

const TABS: ReadonlyArray<{ value: AdminTab; label: string }> = [
  { value: "recipes", label: "Recipes" },
  { value: "comments", label: "Comments" },
  { value: "users", label: "Users" },
];

function isAdminTab(value: string): value is AdminTab {
  return value === "recipes" || value === "comments" || value === "users";
}

function AdminContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab") ?? "recipes";
  const tab = isAdminTab(tabParam) ? tabParam : "recipes";

  const goToTab = (nextTab: AdminTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === "recipes") params.delete("tab");
    else params.set("tab", nextTab);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
          Admin moderation
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hide or restore recipes, moderate comments, and review registered users (FR-ADMIN-01..04).
        </p>
      </div>

      <div
        className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3"
        role="tablist"
        aria-label="Admin sections"
      >
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => goToTab(t.value)}
            className={`rounded-button px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.value
                ? "bg-primary-soft text-primary-strong"
                : "text-muted-foreground hover:bg-background hover:text-heading"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "recipes" && <AdminRecipesPanel />}
      {tab === "comments" && <AdminCommentsPanel />}
      {tab === "users" && <AdminUsersPanel />}
    </main>
  );
}

export default function AdminPage() {
  return (
    <AuthGuard requiredRole="admin" message="Sign in with an admin account to access moderation.">
      <Suspense
        fallback={
          <main className="mx-auto max-w-6xl px-4 py-16">
            <LoadingState label="Loading admin dashboard…" />
          </main>
        }
      >
        <AdminContent />
      </Suspense>
    </AuthGuard>
  );
}

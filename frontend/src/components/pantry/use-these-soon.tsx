"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles } from "@gravity-ui/icons";
import { ApiError, listExpiringPantry } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { PantryItem } from "@/lib/types";
import { Alert, Badge, Card, Spinner } from "@/components/ui";

/** Whole days from today (UTC) to the item's expiry date. */
export function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const target = new Date(expiryDate);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const targetUTC = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
  );
  return Math.round((targetUTC - todayUTC) / 86_400_000);
}

export function expiryLabel(expiryDate: string | null): string {
  const days = daysUntilExpiry(expiryDate);
  if (days === null) return "No expiry date";
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

/**
 * "Use These Soon" — expiring pantry items with a direct link into the
 * recipe generator (`/generator?ingredients=`, no new API).
 * Renders nothing when the pantry has no dated items.
 */
export function UseTheseSoon({ limit = 5 }: { limit?: number }) {
  const { token } = useAuth();
  const [items, setItems] = useState<PantryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    listExpiringPantry({ page: 1, limit }, { token, signal: controller.signal })
      .then((res) => {
        setItems(res.items);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof ApiError ? err.message : "Could not load expiring items.",
        );
      });
    return () => controller.abort();
  }, [token, limit]);

  if (!token || error || items === null || items.length === 0) {
    if (error) {
      return (
        <Alert variant="danger" title="Could not load expiring items">
          {error}
        </Alert>
      );
    }
    if (items === null && token) {
      return (
        <Card className="p-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Spinner className="size-4" aria-hidden="true" />
            Checking expiry dates…
          </p>
        </Card>
      );
    }
    return null;
  }

  return (
    <section aria-label="Use these soon" className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary-strong" aria-hidden="true" />
        <h2 className="text-base font-semibold text-heading">Use These Soon</h2>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <Card className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-heading">{item.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.quantity} {item.unit} · {expiryLabel(item.expiryDate)}
                </p>
                <div className="mt-1.5">
                  <Badge variant={daysUntilExpiry(item.expiryDate) !== null && (daysUntilExpiry(item.expiryDate) as number) <= 2 ? "warning" : "neutral"}>
                    {expiryLabel(item.expiryDate)}
                  </Badge>
                </div>
              </div>
              <Link
                href={`/generator?ingredients=${encodeURIComponent(item.name)}`}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-button bg-primary-strong px-3 text-xs font-medium text-white transition-colors hover:bg-primary-deep"
              >
                Find recipes
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

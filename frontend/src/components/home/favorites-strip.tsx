"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth-context";
import { listFavorites } from "@/lib/api";
import type { FavoriteItem } from "@/lib/types";

const containerClass = "mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8";

export function FavoritesStrip() {
  const { token, user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    listFavorites({ limit: 4 }, { token })
      .then((res) => {
        if (isMounted) {
          setFavorites(res.items);
        }
      })
      .catch(() => {
        if (isMounted) setFavorites([]);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (!token || !user || favorites.length === 0) {
    return null; // Guest or no favorites -> hide strip to keep layout clean
  }

  return (
    <div className={`${containerClass} pb-8 pt-4`}>
      <div className="flex flex-col gap-3 rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-2xs">
            <Heart className="size-4 fill-rose-500 text-rose-500" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-xs font-bold text-heading sm:text-sm">Welcome back, {user.name.split(" ")[0]}!</h3>
            <p className="text-[11px] text-muted-foreground">Quick access to your saved recipes</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {favorites.map((item) => (
            <Link
              key={item.id}
              href={`/recipes/${item.recipe.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-card px-3 py-1.5 text-xs font-semibold text-heading shadow-2xs transition-all hover:border-rose-400 hover:text-rose-700"
            >
              <span className="truncate max-w-[130px]">{item.recipe.title}</span>
            </Link>
          ))}
          <Link
            href="/favorites"
            className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:underline ml-1"
          >
            <span>All ({favorites.length})</span>
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

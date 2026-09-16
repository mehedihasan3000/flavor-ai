import Link from "next/link";
import { Bookmark, Clock, Sparkles, Target } from "@gravity-ui/icons";
import type { RecipeCardData } from "@/lib/types";
import { formatEnumLabel } from "@/lib/format";
import { Badge, Card } from "@/components/ui";
import { RatingStars } from "./rating-stars";

export interface RecipeCardProps {
  recipe: RecipeCardData;
  className?: string;
  /** Taste Matcher result score (0-100), rendered as a corner badge when present. */
  matchScore?: number;
  /** Tooltip text explaining the taste match, shown on the score badge. */
  matchReason?: string;
}

/** Recipe summary card used across discovery/favorites/dashboard grids. */
export function RecipeCard({ recipe, className = "", matchScore, matchReason }: RecipeCardProps) {
  const visibleDietaryLabels = recipe.dietaryLabels.slice(0, 2);
  const extraDietaryCount = recipe.dietaryLabels.length - visibleDietaryLabels.length;

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className={`group block rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
    >
      <Card className="flex h-full flex-col overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-primary-soft">
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Sparkles className="size-8 text-primary/50" aria-hidden="true" />
            </div>
          )}
          {recipe.source === "ai" && (
            <Badge
              variant="primary"
              className="absolute left-2 top-2 bg-card/90 shadow-sm backdrop-blur-sm"
            >
              <Sparkles className="size-3" aria-hidden="true" />
              AI Generated
            </Badge>
          )}
          {recipe.status !== "published" && (
            <Badge
              variant={recipe.status === "draft" ? "warning" : "neutral"}
              className="absolute right-2 top-2 bg-card/90 shadow-sm backdrop-blur-sm"
            >
              {formatEnumLabel(recipe.status)}
            </Badge>
          )}
          {typeof matchScore === "number" && (
            <Badge
              variant="secondary"
              className="absolute bottom-2 right-2 bg-card/90 shadow-sm backdrop-blur-sm"
              title={matchReason}
            >
              <Target className="size-3" aria-hidden="true" />
              {Math.round(matchScore)}% match
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-heading">
            {recipe.title}
          </h3>

          {recipe.summary ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {recipe.summary}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5">
            {recipe.category && <Badge variant="outline">{formatEnumLabel(recipe.category)}</Badge>}
            <Badge variant="outline">{formatEnumLabel(recipe.difficulty)}</Badge>
            {visibleDietaryLabels.map((label) => (
              <Badge key={label} variant="secondary">
                {formatEnumLabel(label)}
              </Badge>
            ))}
            {extraDietaryCount > 0 && <Badge variant="neutral">+{extraDietaryCount}</Badge>}
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <RatingStars value={recipe.averageRating} count={recipe.ratingCount} size="sm" />
            <div className="flex shrink-0 items-center gap-3">
              <span className="flex items-center gap-1">
                <Bookmark className="size-3.5" aria-hidden="true" />
                <span aria-label={`${recipe.favoriteCount} favorites`}>{recipe.favoriteCount}</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden="true" />
                <span aria-label={`${recipe.totalTimeMinutes} minutes total time`}>
                  {recipe.totalTimeMinutes}m
                </span>
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

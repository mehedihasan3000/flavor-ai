"use client";

import { useState } from "react";
import { Star } from "@gravity-ui/icons";

export interface RatingStarsProps {
  /** Rating value, 0-5. Can be fractional for a read-only average display. */
  value: number;
  /** Total number of ratings behind `value`, shown alongside it when provided. */
  count?: number;
  size?: "sm" | "md" | "lg";
  /** Renders a 1-5 star picker instead of a read-only display. */
  interactive?: boolean;
  /** Called with the selected 1-5 value when `interactive` is true. */
  onRate?: (value: 1 | 2 | 3 | 4 | 5) => void;
  disabled?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<RatingStarsProps["size"]>, string> = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
};

const STAR_INDEXES = [0, 1, 2, 3, 4] as const;

function formatCount(count: number): string {
  return count === 1 ? "1 rating" : `${count} ratings`;
}

/**
 * Star rating display/picker (FR-RATE-01..05 UI). Read-only mode renders a
 * fractional fill for averages plus a numeric label so the rating is never
 * conveyed by color/shape alone (NFR-UX-04). Interactive mode is a keyboard-
 * and screen-reader-accessible 1-5 radio group for future use where users
 * submit their own rating.
 */
export function RatingStars({
  value,
  count,
  size = "md",
  interactive = false,
  onRate,
  disabled = false,
  className = "",
}: RatingStarsProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const starClass = SIZE_CLASSES[size];

  if (interactive) {
    const displayValue = hovered ?? value;
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div
          className="flex items-center gap-0.5"
          role="radiogroup"
          aria-label="Rate this recipe, 1 to 5 stars"
          onMouseLeave={() => setHovered(null)}
        >
          {STAR_INDEXES.map((i) => {
            const star = i + 1;
            const filled = star <= displayValue;
            return (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={star === Math.round(value)}
                aria-label={`${star} star${star === 1 ? "" : "s"}`}
                disabled={disabled}
                onMouseEnter={() => setHovered(star)}
                onFocus={() => setHovered(star)}
                onBlur={() => setHovered(null)}
                onClick={() => onRate?.(star as 1 | 2 | 3 | 4 | 5)}
                className="rounded-sm p-0.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Star
                  className={`${starClass} ${filled ? "fill-amber-400" : "fill-border-strong"}`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground">{formatCount(count)}</span>
        )}
      </div>
    );
  }

  const percent = (Math.max(0, Math.min(5, value)) / 5) * 100;

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      role="img"
      aria-label={
        value > 0
          ? `Rated ${value.toFixed(1)} out of 5 stars${count ? `, ${formatCount(count)}` : ""}`
          : "Not yet rated"
      }
    >
      <span className="relative inline-flex shrink-0" aria-hidden="true">
        <span className="flex gap-0.5">
          {STAR_INDEXES.map((i) => (
            <Star key={i} className={`${starClass} fill-border-strong`} />
          ))}
        </span>
        <span
          className="absolute inset-0 flex gap-0.5 overflow-hidden"
          style={{ width: `${percent}%` }}
        >
          {STAR_INDEXES.map((i) => (
            <Star key={i} className={`${starClass} fill-amber-400`} />
          ))}
        </span>
      </span>
      <span className="text-xs font-semibold text-heading">
        {value > 0 ? value.toFixed(1) : "New"}
      </span>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </div>
  );
}

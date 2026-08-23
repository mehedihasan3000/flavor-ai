import type { HTMLAttributes } from "react";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={["animate-pulse rounded-button bg-border/60", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

import type { HTMLAttributes } from "react";

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "outline";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-background text-subtle-foreground",
  primary: "bg-primary-soft text-primary-strong",
  secondary: "bg-secondary-soft text-secondary-strong",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger-strong",
  outline: "border border-border text-subtle-foreground",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

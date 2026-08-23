import type { HTMLAttributes, ReactNode } from "react";
import { CircleCheck, CircleInfo, CircleXmark, TriangleExclamation } from "@gravity-ui/icons";

export type AlertVariant = "info" | "success" | "warning" | "danger";

const VARIANT_CLASSES: Record<
  AlertVariant,
  { wrap: string; iconColor: string; Icon: typeof CircleInfo; role: string }
> = {
  info: {
    wrap: "border-border bg-card",
    iconColor: "text-subtle-foreground",
    Icon: CircleInfo,
    role: "status",
  },
  success: {
    wrap: "border-success/25 bg-success-bg",
    iconColor: "text-success",
    Icon: CircleCheck,
    role: "status",
  },
  warning: {
    wrap: "border-warning/30 bg-warning-bg",
    iconColor: "text-warning",
    Icon: TriangleExclamation,
    role: "status",
  },
  danger: {
    wrap: "border-danger/25 bg-danger-bg",
    iconColor: "text-danger-strong",
    Icon: CircleXmark,
    role: "alert",
  },
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  children?: ReactNode;
}

export function Alert({ variant = "info", title, children, className, ...props }: AlertProps) {
  const { wrap, iconColor, Icon, role } = VARIANT_CLASSES[variant];

  return (
    <div
      role={role}
      className={["flex gap-3 rounded-card border p-4", wrap, className].filter(Boolean).join(" ")}
      {...props}
    >
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${iconColor}`} />
      <div className="min-w-0 text-sm">
        {title ? <p className={`font-semibold ${iconColor}`}>{title}</p> : null}
        <div className={title ? "mt-1 leading-relaxed text-foreground" : "leading-relaxed text-foreground"}>
          {children}
        </div>
      </div>
    </div>
  );
}

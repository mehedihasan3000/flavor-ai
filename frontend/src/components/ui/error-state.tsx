import type { ReactNode } from "react";
import { CircleXmark } from "@gravity-ui/icons";

export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-card border border-danger/25 bg-danger-bg px-6 py-16 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-card text-danger-strong">
        <CircleXmark className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-heading">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-subtle-foreground">{description}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

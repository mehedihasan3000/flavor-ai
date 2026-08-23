import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border-strong bg-card px-6 py-16 text-center">
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-background text-muted-foreground [&>svg]:size-6">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-heading">{title}</h3>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

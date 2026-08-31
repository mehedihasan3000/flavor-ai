"use client";

import type { ReactNode } from "react";
import { CircleXmark } from "@gravity-ui/icons";

export function controlClass(error?: boolean) {
  return `block w-full rounded-button border bg-card px-3 py-2 text-sm text-heading shadow-none transition-colors placeholder:text-muted-foreground focus:border-primary ${
    error ? "border-danger" : "border-border"
  }`;
}

export function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-heading">
      {children}
      {required ? (
        <>
          <span className="text-danger" aria-hidden="true">
            {" "}
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
    </label>
  );
}

export function FieldHint({ id, children }: { id: string; children: ReactNode }) {
  return <p id={id} className="mt-1.5 text-xs text-muted-foreground">{children}</p>;
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-danger-strong"
    >
      <CircleXmark className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

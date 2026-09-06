"use client";

import { useId } from "react";
import type { SelectHTMLAttributes, ReactNode } from "react";
import { ChevronDown } from "@gravity-ui/icons";
import { controlClass, FieldError, FieldHint, FieldLabel } from "./field";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Select({
  label,
  hint,
  error,
  id: idProp,
  required,
  className,
  children,
  ...props
}: SelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={["w-full", className].filter(Boolean).join(" ")}>
      {label ? (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      ) : null}
      <div className="relative w-full">
        <select
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(" ") ||
            undefined
          }
          className={[controlClass(Boolean(error)), "w-full appearance-none pr-9"]
            .filter(Boolean)
            .join(" ")}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      {hint && !error ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

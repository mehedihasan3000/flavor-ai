"use client";

import { useId } from "react";
import type { TextareaHTMLAttributes } from "react";
import { controlClass, FieldError, FieldHint, FieldLabel } from "./field";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Textarea({
  label,
  hint,
  error,
  id: idProp,
  required,
  rows = 4,
  className,
  ...props
}: TextareaProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="w-full">
      {label ? (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      ) : null}
      <textarea
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(" ") ||
          undefined
        }
        className={[controlClass(Boolean(error)), "resize-y", className]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
      {hint && !error ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

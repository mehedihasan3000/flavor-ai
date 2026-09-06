"use client";

import { useId } from "react";
import type { InputHTMLAttributes } from "react";
import { controlClass, FieldError, FieldHint, FieldLabel } from "./field";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapperClassName?: string;
}

export function Input({
  label,
  hint,
  error,
  id: idProp,
  required,
  className,
  wrapperClassName,
  ...props
}: InputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={["w-full", wrapperClassName].filter(Boolean).join(" ")}>
      {label ? (
        <FieldLabel htmlFor={id} required={required}>
          {label}
        </FieldLabel>
      ) : null}
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(" ") ||
          undefined
        }
        className={[controlClass(Boolean(error)), className].filter(Boolean).join(" ")}
        {...props}
      />
      {hint && !error ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Check } from "@gravity-ui/icons";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> {
  label: ReactNode;
  description?: string;
  id?: string;
}

export function Checkbox({ label, description, id: idProp, className, ...props }: CheckboxProps) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <label
      htmlFor={id}
      className="relative flex cursor-pointer select-none items-start gap-2.5"
    >
      <input type="checkbox" id={id} className="peer sr-only" {...props} />
      <span
        aria-hidden="true"
        className="mt-0.5 size-5 shrink-0 rounded-md border border-border-strong bg-card transition-colors peer-checked:border-primary-strong peer-checked:bg-primary-strong peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
      />
      <Check
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0.5 size-5 rounded-md p-1 text-white opacity-0 peer-checked:opacity-100"
      />
      <span className={className ?? "text-sm text-foreground"}>
        {label}
        {description ? (
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

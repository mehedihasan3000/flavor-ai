"use client";

import { useId, useState } from "react";
import type { ClipboardEvent, InputHTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { Xmark } from "@gravity-ui/icons";
import { controlClass, FieldError, FieldHint, FieldLabel } from "./field";

export interface TagInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id"> {
  label?: string;
  hint?: ReactNode;
  error?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  maxTagLength?: number;
  id?: string;
}

function normalizeTags(raw: string[], existing: string[], maxTags: number, maxTagLength: number) {
  const next = [...existing];
  for (const token of raw) {
    const candidate = token.trim().slice(0, maxTagLength);
    if (!candidate) continue;
    if (next.some((tag) => tag.toLowerCase() === candidate.toLowerCase())) continue;
    next.push(candidate);
  }
  return next.slice(0, maxTags);
}

export function TagInput({
  label,
  hint,
  error,
  value,
  onChange,
  maxTags = 30,
  maxTagLength = 100,
  placeholder,
  id: idProp,
  className,
  disabled,
}: TagInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [draft, setDraft] = useState("");

  const addTokens = (rawTokens: string[]) => {
    if (disabled) return;
    const next = normalizeTags(rawTokens, value, maxTags, maxTagLength);
    if (next.length === value.length && !rawTokens.some((token) => token.trim())) {
      setDraft("");
      return;
    }
    onChange(next);
    setDraft("");
  };

  const removeTag = (tag: string) => {
    if (disabled) return;
    onChange(value.filter((item) => item !== tag));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTokens([draft]);
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (!text.includes(",")) return;
    event.preventDefault();
    addTokens(text.split(","));
  };

  return (
    <div className="w-full">
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      {value.length > 0 ? (
        <ul
          aria-label={typeof label === "string" ? `${label} selected items` : "Selected items"}
          className="mb-2 flex flex-wrap gap-1.5"
        >
          {value.map((tag) => (
            <li key={tag}>
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-soft py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary-strong">
                <span className="max-w-[14rem] truncate" title={tag}>
                  {tag}
                </span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove ${tag}`}
                  disabled={disabled}
                  className="-m-1 rounded-full p-1.5 transition-colors hover:bg-primary-deep/10 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <Xmark className="size-3" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        type="text"
        value={draft}
        placeholder={placeholder ?? "Type and press Enter"}
        disabled={disabled}
        aria-describedby={
          [hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(" ") ||
          undefined
        }
        className={[controlClass(Boolean(error)), className].filter(Boolean).join(" ")}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => {
          if (draft.trim()) addTokens([draft]);
        }}
      />
      {hint && !error ? <FieldHint id={hintId}>{hint}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </div>
  );
}

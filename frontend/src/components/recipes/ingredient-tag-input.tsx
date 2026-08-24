"use client";

import { TagInput, type TagInputProps } from "@/components/ui/tag-input";

export interface IngredientTagInputProps extends Omit<TagInputProps, "placeholder"> {
  placeholder?: string;
}

const COMMON_INGREDIENT_SUGGESTIONS = [
  "Chicken Breast",
  "Garlic",
  "Olive Oil",
  "Onion",
  "Tomatoes",
  "Spinach",
  "Eggs",
  "Rice",
  "Butter",
  "Black Pepper",
];

export function IngredientTagInput({
  label = "Ingredients",
  hint = "Type ingredient name and press Enter or comma.",
  placeholder = "Add an ingredient (e.g. Garlic, Chicken)...",
  value,
  onChange,
  ...props
}: IngredientTagInputProps) {
  const addQuickIngredient = (name: string) => {
    if (value.some((item) => item.toLowerCase() === name.toLowerCase())) return;
    onChange([...value, name]);
  };

  return (
    <div className="space-y-2">
      <TagInput
        label={label}
        hint={hint}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        {...props}
      />
      {value.length === 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-medium text-neutral-500">
            Quick add:
          </span>
          {COMMON_INGREDIENT_SUGGESTIONS.slice(0, 5).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => addQuickIngredient(item)}
              className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900 transition"
            >
              + {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

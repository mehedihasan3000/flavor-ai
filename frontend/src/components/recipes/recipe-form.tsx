"use client";

import { useRef, useState } from "react";
import type {
  CreateRecipeInput,
  Difficulty,
  DietaryLabel,
  Recipe,
  RecipeCategory,
  RecipeIngredient,
  RecipeStep,
} from "@/lib/types";
import { ApiError, uploadImage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  TagInput,
  Textarea,
} from "@/components/ui";
import { ArrowDown, ArrowUp, CirclePlus, TrashBin } from "@gravity-ui/icons";

// ─── Constants ────────────────────────────────────────────────────────────────

const DIETARY_OPTIONS: ReadonlyArray<{ value: DietaryLabel; label: string }> = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "halal", label: "Halal" },
  { value: "gluten-free", label: "Gluten-Free" },
  { value: "dairy-free", label: "Dairy-Free" },
  { value: "high-protein", label: "High-Protein" },
  { value: "low-carb", label: "Low-Carb" },
  { value: "keto", label: "Keto" },
];

const DIFFICULTY_OPTIONS: ReadonlyArray<{ value: Difficulty; label: string }> = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const CATEGORY_OPTIONS: ReadonlyArray<{ value: RecipeCategory; label: string }> = [
  { value: "main-course", label: "Main Course" },
  { value: "appetizer", label: "Appetizer" },
  { value: "soup", label: "Soup" },
  { value: "salad", label: "Salad" },
  { value: "side-dish", label: "Side Dish" },
  { value: "baking", label: "Baking" },
  { value: "beverage", label: "Beverage" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecipeFormData {
  title: string;
  slug: string;
  summary: string;
  imageUrl: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  servings: string;
  difficulty: Difficulty;
  cuisine: string;
  category: RecipeCategory | "";
  tags: string[];
  dietaryLabels: DietaryLabel[];
  allergenWarnings: string[];
}

export interface RecipeFormErrors {
  title?: string;
  slug?: string;
  prepTimeMinutes?: string;
  cookTimeMinutes?: string;
  servings?: string;
  ingredients?: string;
  steps?: string;
  [key: string]: string | undefined;
}

export interface RecipeFormProps {
  /** Existing recipe to populate form for edits */
  initialData?: Recipe;
  /** Called with validated input and whether to publish */
  onSubmit: (input: CreateRecipeInput, publish: boolean) => Promise<void>;
  /** Whether form is submitting */
  isSubmitting: boolean;
  /** General error message from parent */
  submitError?: string | null;
  /** Whether this is an edit form */
  mode: "create" | "edit";
  /** Server validation errors */
  serverErrors?: Record<string, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function defaultIngredient(): RecipeIngredient {
  return { name: "", quantity: undefined, unit: "", notes: "" };
}

function defaultStep(index: number): RecipeStep {
  return { stepNumber: index + 1, instruction: "" };
}

function initFormData(initial?: Recipe): RecipeFormData {
  if (!initial) {
    return {
      title: "",
      slug: "",
      summary: "",
      imageUrl: "",
      ingredients: [defaultIngredient()],
      steps: [defaultStep(0)],
      prepTimeMinutes: "",
      cookTimeMinutes: "",
      servings: "2",
      difficulty: "medium",
      cuisine: "",
      category: "",
      tags: [],
      dietaryLabels: [],
      allergenWarnings: [],
    };
  }
  return {
    title: initial.title,
    slug: initial.slug,
    summary: initial.summary ?? "",
    imageUrl: initial.imageUrl ?? "",
    ingredients: initial.ingredients.length ? initial.ingredients : [defaultIngredient()],
    steps: initial.steps.length ? initial.steps : [defaultStep(0)],
    prepTimeMinutes: String(initial.prepTimeMinutes),
    cookTimeMinutes: String(initial.cookTimeMinutes),
    servings: String(initial.servings),
    difficulty: initial.difficulty,
    cuisine: initial.cuisine ?? "",
    category: initial.category ?? "",
    tags: initial.tags ?? [],
    dietaryLabels: initial.dietaryLabels ?? [],
    allergenWarnings: initial.allergenWarnings ?? [],
  };
}

function validate(data: RecipeFormData): RecipeFormErrors {
  const errs: RecipeFormErrors = {};
  if (!data.title.trim()) errs.title = "Title is required.";
  if (!data.slug.trim()) errs.slug = "Slug is required.";
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) {
    errs.slug = "Slug must be lowercase letters, numbers, and hyphens only.";
  }
  const prep = Number(data.prepTimeMinutes);
  if (!data.prepTimeMinutes || isNaN(prep) || prep < 0) {
    errs.prepTimeMinutes = "Enter a valid prep time (0 or more minutes).";
  }
  const cook = Number(data.cookTimeMinutes);
  if (!data.cookTimeMinutes || isNaN(cook) || cook < 1) {
    errs.cookTimeMinutes = "Enter a valid cook time (at least 1 minute).";
  }
  const serv = Number(data.servings);
  if (!data.servings || isNaN(serv) || serv < 1 || serv > 100) {
    errs.servings = "Servings must be between 1 and 100.";
  }
  const hasIngredient = data.ingredients.some((i) => i.name.trim());
  if (!hasIngredient) errs.ingredients = "Add at least one ingredient.";
  const hasStep = data.steps.some((s) => s.instruction.trim());
  if (!hasStep) errs.steps = "Add at least one instruction step.";
  return errs;
}

function toCreateInput(data: RecipeFormData): CreateRecipeInput {
  return {
    title: data.title.trim(),
    slug: data.slug.trim(),
    summary: data.summary.trim() || undefined,
    imageUrl: data.imageUrl.trim() || undefined,
    ingredients: data.ingredients.filter((i) => i.name.trim()),
    steps: data.steps
      .filter((s) => s.instruction.trim())
      .map((s, idx) => ({ ...s, stepNumber: idx + 1 })),
    prepTimeMinutes: Number(data.prepTimeMinutes),
    cookTimeMinutes: Number(data.cookTimeMinutes),
    servings: Number(data.servings),
    difficulty: data.difficulty,
    cuisine: data.cuisine.trim() || undefined,
    category: data.category || undefined,
    tags: data.tags,
    dietaryLabels: data.dietaryLabels,
    allergenWarnings: data.allergenWarnings,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RecipeForm({
  initialData,
  onSubmit,
  isSubmitting,
  submitError,
  mode,
  serverErrors,
}: RecipeFormProps) {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState<RecipeFormData>(() => initFormData(initialData));
  const [errors, setErrors] = useState<RecipeFormErrors>({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [slugWasEdited, setSlugWasEdited] = useState(mode === "edit");
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── Field helpers ──────────────────────────────────────────────────────────
  const setField = <K extends keyof RecipeFormData>(key: K, value: RecipeFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const clearError = (key: string) =>
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setField("title", title);
    clearError("title");
    if (!slugWasEdited) {
      setField("slug", generateSlug(title));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugWasEdited(true);
    setField("slug", e.target.value);
    clearError("slug");
  };

  const handleDietaryToggle = (label: DietaryLabel) => {
    setField(
      "dietaryLabels",
      form.dietaryLabels.includes(label)
        ? form.dietaryLabels.filter((l) => l !== label)
        : [...form.dietaryLabels, label],
    );
  };

  // ── Image upload ───────────────────────────────────────────────────────────
  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setImageUploadError("Image must be under 5 MB.");
      return;
    }
    if (!isAuthenticated) {
      setImageUploadError("Please sign in to upload images.");
      return;
    }
    setImageUploadError(null);
    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        try {
          const result = await uploadImage(base64, file.type, file.name);
          setField("imageUrl", result.url);
        } catch (err) {
          if (err instanceof ApiError) setImageUploadError(err.message);
          else setImageUploadError("Upload failed. Please try again.");
        } finally {
          setUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setImageUploadError("Failed to read file.");
      setUploadingImage(false);
    }
  };

  // ── Ingredients ────────────────────────────────────────────────────────────
  const addIngredient = () => setField("ingredients", [...form.ingredients, defaultIngredient()]);
  const removeIngredient = (idx: number) =>
    setField("ingredients", form.ingredients.filter((_, i) => i !== idx));
  const updateIngredient = (idx: number, field: keyof RecipeIngredient, value: string | number | undefined) =>
    setField(
      "ingredients",
      form.ingredients.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing)),
    );
  const moveIngredient = (idx: number, dir: -1 | 1) => {
    const next = [...form.ingredients];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setField("ingredients", next);
  };

  // ── Steps ──────────────────────────────────────────────────────────────────
  const addStep = () =>
    setField("steps", [...form.steps, defaultStep(form.steps.length)]);
  const removeStep = (idx: number) =>
    setField("steps", form.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepNumber: i + 1 })));
  const updateStep = (idx: number, instruction: string) =>
    setField("steps", form.steps.map((s, i) => (i === idx ? { ...s, instruction } : s)));
  const moveStep = (idx: number, dir: -1 | 1) => {
    const next = [...form.steps];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setField("steps", next.map((s, i) => ({ ...s, stepNumber: i + 1 })));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (publish: boolean) => {
    const validation = validate(form);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }
    setErrors({});
    await onSubmit(toCreateInput(form), publish);
  };

  const allErrors = { ...errors, ...serverErrors };

  return (
    <div className="space-y-8">
      {/* Server submit error */}
      {submitError && (
        <Alert variant="danger" title="Could not save recipe">
          {submitError}
        </Alert>
      )}

      {/* ── Section 1: Core Details ── */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">
          Basic Information
        </h2>
        <div className="space-y-4">
          <Input
            label="Recipe Title"
            required
            placeholder="e.g. Garlic Butter Shrimp Pasta"
            value={form.title}
            onChange={handleTitleChange}
            error={allErrors.title}
            maxLength={120}
          />

          <Input
            label="URL Slug"
            required
            placeholder="garlic-butter-shrimp-pasta"
            value={form.slug}
            onChange={handleSlugChange}
            error={allErrors.slug}
            hint="Lowercase letters, numbers, hyphens only. Auto-generated from the title."
          />

          <Textarea
            label="Summary"
            placeholder="Brief description of the recipe (shown in search results and cards)..."
            value={form.summary}
            rows={3}
            maxLength={500}
            onChange={(e) => setField("summary", e.target.value)}
          />
        </div>
      </Card>

      {/* ── Section 2: Recipe Image ── */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">
          Recipe Image
        </h2>
        <div className="space-y-4">
          {form.imageUrl && (
            <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.imageUrl}
                alt="Recipe preview"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setField("imageUrl", "")}
                className="absolute right-2 top-2 rounded-full bg-white/80 p-1 text-neutral-600 shadow hover:bg-white"
                aria-label="Remove image"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Image URL"
                type="url"
                placeholder="https://..."
                value={form.imageUrl}
                onChange={(e) => setField("imageUrl", e.target.value)}
                hint="Paste an external image URL, or upload a file below."
              />
            </div>
            <div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Upload recipe image"
                onChange={handleImageFile}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
              >
                {uploadingImage ? "Uploading..." : "Upload Image"}
              </Button>
            </div>
          </div>
          {imageUploadError && (
            <p className="text-xs font-medium text-red-600" role="alert">
              {imageUploadError}
            </p>
          )}
        </div>
      </Card>

      {/* ── Section 3: Cooking Metadata ── */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">
          Cooking Details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Prep Time (mins)"
            required
            type="number"
            min={0}
            max={720}
            placeholder="15"
            value={form.prepTimeMinutes}
            onChange={(e) => { setField("prepTimeMinutes", e.target.value); clearError("prepTimeMinutes"); }}
            error={allErrors.prepTimeMinutes}
          />
          <Input
            label="Cook Time (mins)"
            required
            type="number"
            min={1}
            max={720}
            placeholder="30"
            value={form.cookTimeMinutes}
            onChange={(e) => { setField("cookTimeMinutes", e.target.value); clearError("cookTimeMinutes"); }}
            error={allErrors.cookTimeMinutes}
          />
          <Input
            label="Servings"
            required
            type="number"
            min={1}
            max={100}
            placeholder="4"
            value={form.servings}
            onChange={(e) => { setField("servings", e.target.value); clearError("servings"); }}
            error={allErrors.servings}
          />
          <Select
            label="Difficulty"
            value={form.difficulty}
            onChange={(e) => setField("difficulty", e.target.value as Difficulty)}
          >
            {DIFFICULTY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </Select>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input
            label="Cuisine"
            placeholder="e.g. Italian, Thai, Mexican"
            value={form.cuisine}
            onChange={(e) => setField("cuisine", e.target.value)}
          />
          <Select
            label="Category"
            value={form.category}
            onChange={(e) => setField("category", e.target.value as RecipeCategory | "")}
          >
            <option value="">— Select Category —</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
      </Card>

      {/* ── Section 4: Ingredients ── */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">
            Ingredients
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
            <CirclePlus className="h-4 w-4" />
            <span>Add Ingredient</span>
          </Button>
        </div>
        {allErrors.ingredients && (
          <p className="mb-3 text-xs font-medium text-red-600" role="alert">
            {allErrors.ingredients}
          </p>
        )}
        <div className="space-y-3">
          {form.ingredients.map((ing, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-neutral-50/50 p-3"
            >
              {/* Move buttons */}
              <div className="flex flex-col gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => moveIngredient(idx, -1)}
                  disabled={idx === 0}
                  className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                  aria-label={`Move ingredient ${idx + 1} up`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveIngredient(idx, 1)}
                  disabled={idx === form.ingredients.length - 1}
                  className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                  aria-label={`Move ingredient ${idx + 1} down`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Fields */}
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr]">
                <Input
                  placeholder="Ingredient name *"
                  aria-label={`Ingredient ${idx + 1} name`}
                  value={ing.name}
                  onChange={(e) => updateIngredient(idx, "name", e.target.value)}
                />
                <Input
                  placeholder="Quantity"
                  type="number"
                  min={0}
                  step="0.01"
                  aria-label={`Ingredient ${idx + 1} quantity`}
                  value={ing.quantity ?? ""}
                  onChange={(e) =>
                    updateIngredient(idx, "quantity", e.target.value ? Number(e.target.value) : undefined)
                  }
                />
                <Input
                  placeholder="Unit (g, ml…)"
                  aria-label={`Ingredient ${idx + 1} unit`}
                  value={ing.unit ?? ""}
                  onChange={(e) => updateIngredient(idx, "unit", e.target.value)}
                />
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => removeIngredient(idx)}
                disabled={form.ingredients.length === 1}
                className="mt-1 rounded p-1 text-neutral-400 hover:text-red-600 disabled:opacity-30"
                aria-label={`Remove ingredient ${idx + 1}`}
              >
                <TrashBin className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Section 5: Steps ── */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">
            Cooking Steps
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={addStep}>
            <CirclePlus className="h-4 w-4" />
            <span>Add Step</span>
          </Button>
        </div>
        {allErrors.steps && (
          <p className="mb-3 text-xs font-medium text-red-600" role="alert">
            {allErrors.steps}
          </p>
        )}
        <div className="space-y-3">
          {form.steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-3">
              {/* Step number badge */}
              <span className="mt-2.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-900">
                {idx + 1}
              </span>

              <div className="flex-1">
                <Textarea
                  rows={2}
                  placeholder={`Step ${idx + 1} instructions...`}
                  aria-label={`Step ${idx + 1} instruction`}
                  value={step.instruction}
                  onChange={(e) => updateStep(idx, e.target.value)}
                />
              </div>

              {/* Move & Remove */}
              <div className="flex flex-col gap-1 pt-2">
                <button
                  type="button"
                  onClick={() => moveStep(idx, -1)}
                  disabled={idx === 0}
                  className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                  aria-label={`Move step ${idx + 1} up`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveStep(idx, 1)}
                  disabled={idx === form.steps.length - 1}
                  className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                  aria-label={`Move step ${idx + 1} down`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(idx)}
                  disabled={form.steps.length === 1}
                  className="rounded p-0.5 text-neutral-400 hover:text-red-600 disabled:opacity-30"
                  aria-label={`Remove step ${idx + 1}`}
                >
                  <TrashBin className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Section 6: Labels & Tags ── */}
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">
          Dietary Labels & Tags
        </h2>

        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Dietary Labels
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DIETARY_OPTIONS.map((opt) => (
                <Checkbox
                  key={opt.value}
                  id={`edit-diet-${opt.value}`}
                  label={opt.label}
                  checked={form.dietaryLabels.includes(opt.value)}
                  onChange={() => handleDietaryToggle(opt.value)}
                />
              ))}
            </div>
            {form.dietaryLabels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.dietaryLabels.map((d) => (
                  <Badge key={d} variant="success">{d}</Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Allergen Warnings
            </p>
            <TagInput
              value={form.allergenWarnings}
              onChange={(v) => setField("allergenWarnings", v)}
              placeholder="e.g. nuts, gluten, dairy..."
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-neutral-700">
              Search Tags
            </p>
            <TagInput
              value={form.tags}
              onChange={(v) => setField("tags", v)}
              placeholder="e.g. quick, family-friendly, budget..."
            />
          </div>
        </div>
      </Card>

      {/* ── Action Bar ── */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-neutral-200 pt-6">
        {mode === "create" ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save as Draft"}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Publishing..." : "Save & Publish"}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

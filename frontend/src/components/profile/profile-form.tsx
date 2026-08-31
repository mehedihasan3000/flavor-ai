"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Person } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth-context";
import { ApiError, getMyProfile, updateMyProfile, uploadImage } from "@/lib/api";
import type {
  Difficulty,
  DietaryLabel,
  DietaryPreferences,
  ErrorCode,
  UpdateProfileInput,
  UserProfile,
} from "@/lib/types";
import { Alert, Button, Card, Checkbox, EmptyState, ErrorState, Input, LoadingState, Select, TagInput, Textarea } from "@/components/ui";

const DIETARY_OPTIONS: ReadonlyArray<{ value: DietaryLabel; label: string }> = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "halal", label: "Halal" },
  { value: "gluten-free", label: "Gluten-free" },
  { value: "dairy-free", label: "Dairy-free" },
  { value: "high-protein", label: "High-protein" },
  { value: "low-carb", label: "Low-carb" },
  { value: "keto", label: "Keto" },
];

interface FormState {
  name: string;
  avatarUrl: string;
  bio: string;
  dietaryLabels: DietaryLabel[];
  allergies: string[];
  dislikedIngredients: string[];
  calorieTarget: string;
  proteinTargetGrams: string;
  cookingTimeMaxMinutes: string;
  difficulty: Difficulty | "";
}

type FieldName =
  | "name"
  | "avatarUrl"
  | "bio"
  | "calorieTarget"
  | "proteinTargetGrams"
  | "cookingTimeMaxMinutes";

type FieldErrors = Partial<Record<FieldName, string>>;

const EMPTY_FORM: FormState = {
  name: "",
  avatarUrl: "",
  bio: "",
  dietaryLabels: [],
  allergies: [],
  dislikedIngredients: [],
  calorieTarget: "",
  proteinTargetGrams: "",
  cookingTimeMaxMinutes: "",
  difficulty: "",
};

function profileToForm(profile: UserProfile): FormState {
  const preferences = profile.preferences;
  return {
    name: profile.name ?? "",
    avatarUrl: profile.avatarUrl ?? "",
    bio: profile.bio ?? "",
    dietaryLabels: preferences?.dietaryLabels ?? [],
    allergies: preferences?.allergies ?? [],
    dislikedIngredients: preferences?.dislikedIngredients ?? [],
    calorieTarget:
      preferences?.calorieTarget != null ? String(preferences.calorieTarget) : "",
    proteinTargetGrams:
      preferences?.proteinTargetGrams != null ? String(preferences.proteinTargetGrams) : "",
    cookingTimeMaxMinutes:
      preferences?.cookingTimeMaxMinutes != null
        ? String(preferences.cookingTimeMaxMinutes)
        : "",
    difficulty: preferences?.difficulty ?? "",
  };
}

function optionalPositiveInt(value: string): number | undefined | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d+$/.test(trimmed) || Number(trimmed) <= 0) return "invalid";
  return Number(trimmed);
}

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Display name is required.";
  else if (name.length > 100) errors.name = "Display name must be at most 100 characters.";

  const avatar = form.avatarUrl.trim();
  if (avatar) {
    if (avatar.length > 500) errors.avatarUrl = "Avatar URL must be at most 500 characters.";
    else {
      try {
        const url = new URL(avatar);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
          errors.avatarUrl = "Avatar URL must use http or https.";
        }
      } catch {
        errors.avatarUrl = "Please enter a valid URL.";
      }
    }
  }

  const bio = form.bio.trim();
  if (bio.length > 500) errors.bio = "Bio must be at most 500 characters.";

  const calorie = optionalPositiveInt(form.calorieTarget);
  if (calorie === "invalid") errors.calorieTarget = "Calorie target must be a positive number.";

  const protein = optionalPositiveInt(form.proteinTargetGrams);
  if (protein === "invalid") errors.proteinTargetGrams = "Protein target must be a positive number.";

  const cooking = optionalPositiveInt(form.cookingTimeMaxMinutes);
  if (cooking === "invalid") errors.cookingTimeMaxMinutes = "Cooking time must be a positive number.";

  return errors;
}

export function ProfileForm({ token: explicitToken }: { token?: string }) {
  const { token: authContextToken, isLoading: isAuthLoading, patchUser } = useAuth();
  const token = explicitToken ?? authContextToken;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [loadErrorCode, setLoadErrorCode] = useState<ErrorCode | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formAlert, setFormAlert] = useState<{ variant: "success" | "danger"; message: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const [avatarPreviewFailed, setAvatarPreviewFailed] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Reset preview error when URL changes (e.g. after Google login or manual edit)
  useEffect(() => {
    Promise.resolve().then(() => setAvatarPreviewFailed(false));
  }, [form.avatarUrl]);

  const loadProfile = useCallback(
    (signal?: AbortSignal) => {
      if (!token) {
        return Promise.resolve().then(() => {
          setLoadErrorCode("UNAUTHORIZED");
          setLoadStatus("error");
        });
      }

      return getMyProfile({ signal, token })

        .then((data) => {
          setProfile(data);
          setForm(profileToForm(data));
          setLoadErrorCode(null);
          setLoadError("");
          setLoadStatus("ready");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setLoadErrorCode(error instanceof ApiError ? error.code : null);
          setLoadError(
            error instanceof ApiError
              ? error.message
              : "Cannot reach the FlavorAI API. Check your connection and try again.",
          );
          setLoadStatus("error");
        });
    },
    [token],
  );

  useEffect(() => {
    if (isAuthLoading) return;
    const controller = new AbortController();
    void loadProfile(controller.signal);
    return () => controller.abort();
  }, [loadProfile, isAuthLoading]);

  const retryLoad = () => {
    setLoadStatus("loading");
    void loadProfile();
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleDietary = (value: DietaryLabel, checked: boolean) => {
    setForm((current) => ({
      ...current,
      dietaryLabels: checked
        ? [...current.dietaryLabels, value]
        : current.dietaryLabels.filter((item) => item !== value),
    }));
  };

  // ── Avatar image upload (mirrors recipe-form.tsx:257-290) ──────────────────
  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAvatarUploadError("Image must be under 5 MB.");
      e.target.value = "";
      return;
    }
    if (!token) {
      setAvatarUploadError("Please sign in to upload images.");
      e.target.value = "";
      return;
    }
    setAvatarUploadError(null);
    setUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        try {
          const result = await uploadImage(base64, file.type, file.name, { token });
          setField("avatarUrl", result.url);
          setFieldErrors((prev) => {
            const next = { ...prev };
            delete next.avatarUrl;
            return next;
          });
        } catch (err) {
          if (err instanceof ApiError) setAvatarUploadError(err.message);
          else setAvatarUploadError("Upload failed. Please try again.");
        } finally {
          setUploadingAvatar(false);
          e.target.value = "";
        }
      };
      reader.onerror = () => {
        setAvatarUploadError("Failed to read file.");
        setUploadingAvatar(false);
        e.target.value = "";
      };
      reader.readAsDataURL(file);
    } catch {
      setAvatarUploadError("Failed to read file.");
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    setFormAlert(null);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const calorieTarget = optionalPositiveInt(form.calorieTarget);
      const proteinTargetGrams = optionalPositiveInt(form.proteinTargetGrams);
      const cookingTimeMaxMinutes = optionalPositiveInt(form.cookingTimeMaxMinutes);

      const preferences: DietaryPreferences = {
        dietaryLabels: form.dietaryLabels,
        allergies: form.allergies,
        dislikedIngredients: form.dislikedIngredients,
      };
      if (calorieTarget !== undefined && calorieTarget !== "invalid") {
        preferences.calorieTarget = calorieTarget;
      }
      if (proteinTargetGrams !== undefined && proteinTargetGrams !== "invalid") {
        preferences.proteinTargetGrams = proteinTargetGrams;
      }
      if (cookingTimeMaxMinutes !== undefined && cookingTimeMaxMinutes !== "invalid") {
        preferences.cookingTimeMaxMinutes = cookingTimeMaxMinutes;
      }
      if (form.difficulty) preferences.difficulty = form.difficulty;

      const payload: UpdateProfileInput = {
        name: form.name.trim(),
        avatarUrl: form.avatarUrl.trim() || null,
        bio: form.bio.trim(),
        preferences,
      };

      const updated = await updateMyProfile(payload, { token });
      setProfile(updated);
      setForm(profileToForm(updated));
      patchUser({ name: updated.name, avatarUrl: updated.avatarUrl ?? null });
      setFormAlert({ variant: "success", message: "Your profile has been updated." });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof ApiError) {
        if (error.validation) {
          const serverFieldErrors: FieldErrors = {};
          for (const key of Object.keys(error.validation)) {
            if ((key as FieldName) in EMPTY_FORM || key === "preferences") continue;
            serverFieldErrors[key as FieldName] = error.validation[key];
          }
          setFieldErrors(serverFieldErrors);
        }
        setFormAlert({
          variant: "danger",
          message:
            error.code === "UNAUTHORIZED"
              ? "Your session has expired. Please sign in again."
              : error.message,
        });
      } else {
        setFormAlert({
          variant: "danger",
          message: "Cannot reach the FlavorAI API. Check your connection and try again.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadStatus === "loading") {
    return <LoadingState label="Loading your profile…" />;
  }

  if (loadStatus === "error") {
    if (loadErrorCode === "UNAUTHORIZED") {
      return (
        <EmptyState
          icon={<Person />}
          title="Sign in required"
          description="Sign in to view and edit your profile and food preferences."
          action={
            <Link href="/sign-in" className="inline-flex h-10 items-center justify-center rounded-button bg-primary-strong px-4 text-sm font-medium text-white transition-colors hover:bg-primary-deep">
              Go to sign in
            </Link>
          }
        />
      );
    }
    return (
      <ErrorState description={loadError} action={
        <Button variant="outline" onClick={retryLoad}>
          Try again
        </Button>
      } />
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="space-y-6">
        {formAlert ? (
          <Alert variant={formAlert.variant}>{formAlert.message}</Alert>
        ) : null}

        <Card className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-heading">Basic information</h2>
          <div className="mt-5 grid gap-5">
            <Input
              label="Display name"
              required
              maxLength={100}
              autoComplete="name"
              value={form.name}
              error={fieldErrors.name}
              onChange={(event) => setField("name", event.target.value)}
              disabled={saving}
            />

            {/* Avatar — preview + URL + file upload (mirrors recipe-form.tsx:257-290) */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-neutral-100">
                  {form.avatarUrl.trim() && !avatarPreviewFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.avatarUrl.trim()}
                      alt="Avatar preview"
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarPreviewFailed(true)}
                    />
                  ) : (
                    <Person className="size-8 text-muted-foreground" aria-hidden="true" />
                  )}
                  {form.avatarUrl.trim() ? (
                    <button
                      type="button"
                      onClick={() => {
                        setField("avatarUrl", "");
                        setAvatarUploadError(null);
                        if (avatarInputRef.current) avatarInputRef.current.value = "";
                      }}
                      className="absolute right-0.5 top-0.5 flex size-6 items-center justify-center rounded-full bg-white/90 text-neutral-600 shadow hover:bg-white hover:text-neutral-900"
                      aria-label="Remove avatar"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-heading">Profile photo</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Upload a file or paste an image URL. JPG, PNG, WEBP or GIF — max 5 MB.
                  </p>
                  {form.avatarUrl.trim() ? (
                    <button
                      type="button"
                      onClick={() => {
                        setField("avatarUrl", "");
                        setAvatarUploadError(null);
                        if (avatarInputRef.current) avatarInputRef.current.value = "";
                      }}
                      className="text-xs font-medium text-danger-strong hover:underline"
                    >
                      Remove photo
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input
                    label="Avatar URL"
                    type="url"
                    placeholder="https://example.com/avatar.jpg"
                    value={form.avatarUrl}
                    error={fieldErrors.avatarUrl}
                    onChange={(event) => {
                      setField("avatarUrl", event.target.value);
                      setAvatarUploadError(null);
                    }}
                    disabled={saving || uploadingAvatar}
                    hint="Paste an external image URL, or upload a file →"
                  />
                </div>
                <div className="flex shrink-0 flex-col">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    aria-label="Upload avatar image"
                    onChange={handleAvatarFile}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar || saving}
                    className="w-full sm:w-auto"
                  >
                    {uploadingAvatar ? "Uploading..." : "Upload Image"}
                  </Button>
                </div>
              </div>
              {avatarUploadError && (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {avatarUploadError}
                </p>
              )}
            </div>

            <Textarea
              label="Bio"
              maxLength={500}
              rows={3}
              hint={`${form.bio.length}/500 characters`}
              value={form.bio}
              error={fieldErrors.bio}
              onChange={(event) => setField("bio", event.target.value)}
              disabled={saving}
            />
          </div>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-heading">Food preferences</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Used to personalize AI recipe generation. You can override them on every request.
          </p>

          <fieldset className="mt-6" disabled={saving}>
            <legend className="text-sm font-medium text-heading">Dietary labels</legend>
            <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              {DIETARY_OPTIONS.map((option) => (
                <Checkbox
                  key={option.value}
                  label={option.label}
                  checked={form.dietaryLabels.includes(option.value)}
                  onChange={(event) => toggleDietary(option.value, event.target.checked)}
                />
              ))}
            </div>
          </fieldset>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <TagInput
              label="Allergies"
              placeholder="e.g. peanuts — press Enter to add"
              value={form.allergies}
              onChange={(tags) => setField("allergies", tags)}
              disabled={saving}
            />
            <TagInput
              label="Disliked ingredients"
              placeholder="e.g. cilantro — press Enter to add"
              value={form.dislikedIngredients}
              onChange={(tags) => setField("dislikedIngredients", tags)}
              disabled={saving}
            />
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Calorie target (kcal/day)"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="2000"
              value={form.calorieTarget}
              error={fieldErrors.calorieTarget}
              onChange={(event) => setField("calorieTarget", event.target.value)}
              disabled={saving}
            />
            <Input
              label="Protein target (g/day)"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="100"
              value={form.proteinTargetGrams}
              error={fieldErrors.proteinTargetGrams}
              onChange={(event) => setField("proteinTargetGrams", event.target.value)}
              disabled={saving}
            />
            <Input
              label="Max cooking time (min)"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="45"
              value={form.cookingTimeMaxMinutes}
              error={fieldErrors.cookingTimeMaxMinutes}
              onChange={(event) => setField("cookingTimeMaxMinutes", event.target.value)}
              disabled={saving}
            />
            <Select
              label="Preferred difficulty"
              value={form.difficulty}
              onChange={(event) =>
                setField("difficulty", event.target.value as Difficulty | "")
              }
              disabled={saving}
            >
              <option value="">Any</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </div>
        </Card>

        <div className="flex items-center justify-between gap-4">
          <p className="hidden text-xs text-muted-foreground sm:block">
            Signed in as{" "}
            <span className="font-medium text-subtle-foreground">{profile?.email}</span>
          </p>
          <Button type="submit" loading={saving} className="ml-auto min-w-36">
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}

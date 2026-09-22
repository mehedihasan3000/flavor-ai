"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Magnifier, Minus, Pencil, Plus, TrashBin, Xmark } from "@gravity-ui/icons";
import { AuthGuard } from "@/components/auth";
import { UseTheseSoon, expiryLabel, daysUntilExpiry } from "@/components/pantry/use-these-soon";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from "@/components/ui";
import {
  ApiError,
  createPantryItem,
  deletePantryItem,
  listPantryItems,
  updatePantryItem,
  usePantryItem as consumePantryItem,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type {
  CreatePantryItemInput,
  PaginatedResult,
  PantryCategory,
  PantryItem,
} from "@/lib/types";

const PAGE_SIZE = 20;

const CATEGORIES: ReadonlyArray<{ value: PantryCategory | ""; label: string }> = [
  { value: "", label: "All categories" },
  { value: "vegetables", label: "Vegetables" },
  { value: "fruits", label: "Fruits" },
  { value: "meat", label: "Meat" },
  { value: "dairy", label: "Dairy" },
  { value: "grains", label: "Grains" },
  { value: "spices", label: "Spices" },
  { value: "frozen", label: "Frozen" },
  { value: "snacks", label: "Snacks" },
  { value: "other", label: "Other" },
];

const UNIT_HINTS = ["g", "kg", "ml", "l", "pcs", "tbsp", "tsp", "cup"];

interface FormState {
  name: string;
  quantity: string;
  unit: string;
  category: PantryCategory | "";
  expiryDate: string;
  lowStockThreshold: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  quantity: "",
  unit: "",
  category: "",
  expiryDate: "",
  lowStockThreshold: "",
  notes: "",
};

function itemToForm(item: PantryItem): FormState {
  return {
    name: item.name,
    quantity: String(item.quantity),
    unit: item.unit,
    category: item.category,
    expiryDate: item.expiryDate ? item.expiryDate.slice(0, 10) : "",
    lowStockThreshold:
      item.lowStockThreshold !== null ? String(item.lowStockThreshold) : "",
    notes: item.notes,
  };
}

function validateForm(form: FormState): string | null {
  if (!form.name.trim()) return "Ingredient name is required.";
  if (form.name.trim().length > 100) return "Ingredient name must be at most 100 characters.";
  if (!form.quantity.trim()) return "Quantity is required.";
  const qty = Number(form.quantity);
  if (!Number.isFinite(qty) || qty < 0) return "Quantity must be 0 or greater.";
  if (!form.unit.trim()) return "Unit is required.";
  if (form.unit.trim().length > 30) return "Unit must be at most 30 characters.";
  if (!form.category) return "Category is required.";
  if (form.expiryDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.expiryDate)) return "Expiry date must use YYYY-MM-DD.";
    // UTC to match the server's today-or-future check (local midnight would
    // disagree near day boundaries in far-offset zones).
    const now = new Date();
    const todayUTC = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
    if (form.expiryDate < todayUTC) return "Expiry date cannot be in the past.";
  }
  if (form.lowStockThreshold.trim()) {
    const threshold = Number(form.lowStockThreshold);
    if (!Number.isFinite(threshold) || threshold < 0) {
      return "Low-stock threshold must be 0 or greater.";
    }
  }
  if (form.notes.length > 200) return "Notes must be at most 200 characters.";
  return null;
}

function PantryContent() {
  const { token } = useAuth();

  const [result, setResult] = useState<PaginatedResult<PantryItem> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<PantryCategory | "">("");
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Synchronous in-flight guard (same pattern as the generator's saveInFlight
  // ref): state updates are async, so same-tick double-taps would otherwise
  // both compute from the same rendered quantity and lose an increment.
  const stepInFlight = useRef<Set<string>>(new Set());
  // Snapshot of the form when the edit dialog opened — distinguishes
  // "cleared" (send explicit null) from "untouched".
  const editInitial = useRef<FormState | null>(null);

  // Debounced search — state updates happen in the timeout callback only.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchDraft.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!token) {
        return Promise.resolve().then(() => {
          setIsLoading(false);
        });
      }
      return Promise.resolve()
        .then(() => {
          setIsLoading(true);
          setError(null);
        })
        .then(() =>
          listPantryItems(
            {
              page,
              limit: PAGE_SIZE,
              ...(search ? { q: search } : {}),
              ...(category ? { category } : {}),
              ...(expiringOnly ? { expiringWithinDays: 7 } : {}),
              ...(lowStockOnly ? { lowStock: true } : {}),
            },
            { token, signal },
          ),
        )
        .then((data) => {
          setResult(data);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(
            err instanceof ApiError ? err.message : "Failed to load pantry. Please try again.",
          );
          setIsLoading(false);
        });
    },
    [token, page, search, category, expiringOnly, lowStockOnly],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (item: PantryItem) => {
    setEditingId(item.id);
    const initial = itemToForm(item);
    setForm(initial);
    editInitial.current = initial;
    setFormError(null);
    setConfirmDeleteId(null);
    setFormOpen(true);
  };

  const handleSubmit = () => {
    const validation = validateForm(form);
    if (validation) {
      setFormError(validation);
      return;
    }
    setSaving(true);
    setFormError(null);
    setActionError(null);
    const initial = editingId ? editInitial.current : null;
    const payload: CreatePantryItemInput = {
      name: form.name.trim(),
      quantity: Number(form.quantity),
      unit: form.unit.trim(),
      category: form.category as PantryCategory,
      // On edit, an emptied optional clears the stored value (explicit null);
      // on add, empties are simply omitted.
      ...(form.expiryDate
        ? { expiryDate: form.expiryDate }
        : initial && initial.expiryDate
          ? { expiryDate: null }
          : {}),
      ...(form.lowStockThreshold.trim()
        ? { lowStockThreshold: Number(form.lowStockThreshold) }
        : initial && initial.lowStockThreshold.trim()
          ? { lowStockThreshold: null }
          : {}),
      ...(form.notes.trim()
        ? { notes: form.notes.trim() }
        : initial && initial.notes
          ? { notes: "" }
          : {}),
    };
    const request = editingId
      ? updatePantryItem(editingId, payload, { token })
      : createPantryItem(payload, { token });
    request
      .then(() => {
        setFormOpen(false);
        setSaving(false);
        if (editingId === null) setPage(1);
        void load();
      })
      .catch((err: unknown) => {
        setFormError(
          err instanceof ApiError ? err.message : "Could not save the item. Please try again.",
        );
        setSaving(false);
      });
  };

  const handleStep = (item: PantryItem, delta: 1 | -1) => {
    if (stepInFlight.current.has(item.id)) return;
    stepInFlight.current.add(item.id);
    setBusyId(item.id);
    setActionError(null);
    const request =
      delta === -1
        ? consumePantryItem(item.id, { quantity: 1 }, { token })
        : updatePantryItem(item.id, { quantity: item.quantity + 1 }, { token });
    request
      .then(() => {
        stepInFlight.current.delete(item.id);
        setBusyId(null);
        void load();
      })
      .catch((err: unknown) => {
        stepInFlight.current.delete(item.id);
        setBusyId(null);
        setActionError(
          err instanceof ApiError ? err.message : "Could not update quantity. Please try again.",
        );
      });
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setBusyId(id);
    setActionError(null);
    deletePantryItem(id, { token })
      .then(() => {
        setBusyId(null);
        setConfirmDeleteId(null);
        void load();
      })
      .catch((err: unknown) => {
        setBusyId(null);
        setActionError(
          err instanceof ApiError ? err.message : "Could not delete the item. Please try again.",
        );
      });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading sm:text-3xl">
            My Pantry
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track what you have, use what expires first, and plan smarter meals.
          </p>
        </div>
        <Button type="button" onClick={openAdd}>
          Add ingredient
        </Button>
      </div>

      <UseTheseSoon />

      {actionError && (
        <Alert variant="danger" title="Something went wrong">
          <div className="flex items-start justify-between gap-3">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              aria-label="Dismiss error"
              className="shrink-0 text-xs font-semibold underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      )}

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Magnifier
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Search pantry"
              placeholder="Search ingredients…"
              value={searchDraft}
              onChange={(e) => {
                setSearchDraft(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as PantryCategory | "");
              setPage(1);
            }}
          >
            {CATEGORIES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Checkbox
              id="pantry-expiring"
              label="Expiring soon"
              checked={expiringOnly}
              onChange={(e) => {
                setExpiringOnly(e.target.checked);
                setPage(1);
              }}
            />
            <Checkbox
              id="pantry-low-stock"
              label="Low stock"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <LoadingState label="Loading your pantry…" />
      ) : error ? (
        <ErrorState
          description={error}
          action={
            <Button type="button" variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : !result || result.items.length === 0 ? (
        <EmptyState
          title="Your pantry is empty"
          description="Your pantry is empty. Add your first ingredient to start planning smarter meals."
          action={
            <Button type="button" onClick={openAdd}>
              Add your first ingredient
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {result.total} ingredient{result.total === 1 ? "" : "s"}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((item) => {
              const days = daysUntilExpiry(item.expiryDate);
              const urgent = days !== null && days <= 2;
              return (
                <li key={item.id}>
                  <Card className="flex h-full flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-heading">{item.name}</p>
                        <p className="mt-0.5 text-sm text-subtle-foreground">
                          {item.quantity} {item.unit}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          aria-label={`Edit ${item.name}`}
                          className="flex size-9 items-center justify-center rounded-button text-muted-foreground transition-colors hover:bg-background hover:text-heading disabled:opacity-55"
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={busyId === item.id}
                          aria-label={
                            confirmDeleteId === item.id
                              ? `Confirm deletion of ${item.name}`
                              : `Delete ${item.name}`
                          }
                          className={`flex size-9 items-center justify-center rounded-button transition-colors disabled:opacity-55 ${
                            confirmDeleteId === item.id
                              ? "bg-danger-bg font-semibold text-danger-strong"
                              : "text-muted-foreground hover:bg-background hover:text-danger-strong"
                          }`}
                        >
                          <TrashBin className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    {confirmDeleteId === item.id && (
                      <p className="text-xs font-medium text-danger-strong" role="alert">
                        Tap delete again to confirm removal.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="neutral" className="capitalize">
                        {item.category}
                      </Badge>
                      {item.expiryDate && (
                        <Badge variant={urgent ? "warning" : "neutral"}>
                          {expiryLabel(item.expiryDate)}
                        </Badge>
                      )}
                      {item.lowStock && <Badge variant="danger">Low stock</Badge>}
                    </div>
                    {item.notes && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{item.notes}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground">Adjust quantity</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStep(item, -1)}
                          disabled={busyId === item.id || item.quantity <= 0}
                          aria-label={`Use one ${item.unit} of ${item.name}`}
                          className="flex size-9 items-center justify-center rounded-button border border-border text-heading transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          <Minus className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStep(item, 1)}
                          disabled={busyId === item.id}
                          aria-label={`Add one ${item.unit} of ${item.name}`}
                          className="flex size-9 items-center justify-center rounded-button border border-border text-heading transition-colors hover:bg-background disabled:opacity-55"
                        >
                          <Plus className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          {result.totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3" aria-label="Pantry pages">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="px-2 text-xs font-medium text-muted-foreground">
                Page {result.page} of {result.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= result.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => {
            if (!saving) setFormOpen(false);
          }}
        >
          <Card
            className="max-h-[90vh] w-full max-w-md overflow-y-auto p-6"
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? "Edit pantry item" : "Add pantry item"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-heading">
                {editingId ? "Edit ingredient" : "Add ingredient"}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                disabled={saving}
                aria-label="Close dialog"
                className="flex size-9 items-center justify-center rounded-button text-muted-foreground hover:bg-background hover:text-heading"
              >
                <Xmark className="size-4" aria-hidden="true" />
              </button>
            </div>
            {formError && (
              <div className="mt-4">
                <Alert variant="danger">{formError}</Alert>
              </div>
            )}
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <Input
                label="Ingredient name"
                required
                maxLength={100}
                placeholder="e.g. Chicken"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={saving}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Quantity"
                  required
                  type="number"
                  min={0}
                  step="any"
                  placeholder="500"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  disabled={saving}
                />
                <Input
                  label="Unit"
                  required
                  maxLength={30}
                  placeholder="g"
                  list="pantry-unit-hints"
                  hint={UNIT_HINTS.join(" · ")}
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  disabled={saving}
                />
                <datalist id="pantry-unit-hints">
                  {UNIT_HINTS.map((unit) => (
                    <option key={unit} value={unit} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Category"
                  required
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value as PantryCategory | "" }))
                  }
                  disabled={saving}
                >
                  <option value="">Select…</option>
                  {CATEGORIES.filter((c) => c.value).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Expiry date"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <Input
                label="Low-stock threshold (optional)"
                type="number"
                min={0}
                step="any"
                placeholder="e.g. 100"
                value={form.lowStockThreshold}
                onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))}
                disabled={saving}
              />
              <Input
                label="Notes (optional)"
                maxLength={200}
                placeholder="e.g. in the freezer"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                disabled={saving}
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : editingId ? "Save changes" : "Add ingredient"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </main>
  );
}

export default function PantryPage() {
  return (
    <AuthGuard message="Sign in to manage your personal pantry.">
      <PantryContent />
    </AuthGuard>
  );
}

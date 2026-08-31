"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CircleCheck,
  CircleInfo,
  CircleXmark,
  TriangleExclamation,
  Xmark,
} from "@gravity-ui/icons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastVariant = "success" | "danger" | "info" | "warning";

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title?: string;
  description: string;
  duration: number;
}

interface ToastInput {
  description: string;
  title?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (input: ToastInput) => string;
  removeToast: (id: string) => void;
  success: (description: string, opts?: Omit<ToastInput, "description" | "variant">) => string;
  error: (description: string, opts?: Omit<ToastInput, "description" | "variant">) => string;
  info: (description: string, opts?: Omit<ToastInput, "description" | "variant">) => string;
  warning: (description: string, opts?: Omit<ToastInput, "description" | "variant">) => string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_DURATION = 4000;

function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const VARIANT_META: Record<
  ToastVariant,
  { Icon: typeof CircleInfo; wrap: string; icon: string; title: string; role: string }
> = {
  success: {
    Icon: CircleCheck,
    wrap: "border-success/30 bg-card",
    icon: "text-success",
    title: "text-success",
    role: "status",
  },
  danger: {
    Icon: CircleXmark,
    wrap: "border-danger/25 bg-card",
    icon: "text-danger-strong",
    title: "text-danger-strong",
    role: "alert",
  },
  warning: {
    Icon: TriangleExclamation,
    wrap: "border-warning/30 bg-card",
    icon: "text-warning",
    title: "text-warning",
    role: "status",
  },
  info: {
    Icon: CircleInfo,
    wrap: "border-border bg-card",
    icon: "text-subtle-foreground",
    title: "text-foreground",
    role: "status",
  },
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (input: ToastInput) => {
      const id = createId();
      const item: ToastItem = {
        id,
        variant: input.variant ?? "info",
        title: input.title,
        description: input.description,
        duration: input.duration ?? DEFAULT_DURATION,
      };
      setToasts((prev) => [...prev, item]);

      if (item.duration > 0 && Number.isFinite(item.duration)) {
        const timer = setTimeout(() => removeToast(id), item.duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [removeToast],
  );

  const success = useCallback(
    (description: string, opts?: Omit<ToastInput, "description" | "variant">) =>
      addToast({ ...opts, description, variant: "success" }),
    [addToast],
  );
  const error = useCallback(
    (description: string, opts?: Omit<ToastInput, "description" | "variant">) =>
      addToast({ ...opts, description, variant: "danger" }),
    [addToast],
  );
  const info = useCallback(
    (description: string, opts?: Omit<ToastInput, "description" | "variant">) =>
      addToast({ ...opts, description, variant: "info" }),
    [addToast],
  );
  const warning = useCallback(
    (description: string, opts?: Omit<ToastInput, "description" | "variant">) =>
      addToast({ ...opts, description, variant: "warning" }),
    [addToast],
  );

  // Cleanup timers on unmount
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, addToast, removeToast, success, error, info, warning }),
    [toasts, addToast, removeToast, success, error, info, warning],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Viewport — fixed bottom-right corner, pointer-events safe
// ---------------------------------------------------------------------------

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex flex-col gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-sm sm:w-full"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  const meta = VARIANT_META[toast.variant];
  const Icon = meta.Icon;

  return (
    <div
      role={meta.role}
      className={[
        "pointer-events-auto flex gap-3 rounded-card border p-4 shadow-xl backdrop-blur-sm",
        "animate-[toast-in_0.28s_ease-out]",
        meta.wrap,
      ].join(" ")}
    >
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${meta.icon}`} />
      <div className="min-w-0 flex-1">
        {toast.title ? <p className={`text-sm font-semibold leading-none ${meta.title}`}>{toast.title}</p> : null}
        <p className={["text-sm leading-relaxed text-foreground", toast.title ? "mt-1" : ""].join(" ")}>
          {toast.description}
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="pointer-events-auto -mr-1 -mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-subtle-foreground transition hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Xmark aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

import type { MacroAdjustmentResult } from "./types";

/**
 * sessionStorage persistence for the Food & Nutrition AI Assistant conversation.
 *
 * - Tab-scoped by design: survives refresh + in-tab navigation, vanishes on tab close.
 * - Database documents are NEVER stored: `cards` (full Recipe objects) are
 *   stripped on write; only display text, macro numbers, and metadata persist.
 * - No tokens, no profile data, no RAG context — just the visible conversation.
 * - All access is SSR-safe (returns defaults outside the browser) and wrapped
 *   in try/catch so a storage failure never breaks the chat (in-memory fallback).
 */

/** Namespaced key, following the `flavorai_*` storage-key convention. */
export const ASSISTANT_STORAGE_KEY = "flavorai_ai_assistant_messages";

/** Max messages kept — most recent win; bounds sessionStorage growth. */
export const MAX_STORED_MESSAGES = 50;

/** Max chars accepted per stored text field (backend caps: user 2000, assistant 4000). */
const MAX_STORED_TEXT = 10000;

/** Minimal storable shape of a chat turn (mirrors `ChatMessage` minus `cards`). */
export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  origin: "chat" | "action";
  macro?: MacroAdjustmentResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, max = MAX_STORED_TEXT): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function isValidMacro(value: unknown): value is MacroAdjustmentResult {
  if (!isRecord(value)) return false;
  if (!isRecord(value.recommendation)) return false;
  const rec = value.recommendation as Record<string, unknown>;
  for (const key of ["calories", "proteinGrams", "carbohydratesGrams", "fatGrams"]) {
    if (typeof rec[key] !== "number" || !Number.isFinite(rec[key])) return false;
  }
  if (!Array.isArray(value.changes)) return false;
  for (const change of value.changes) {
    if (!isRecord(change)) return false;
    if (typeof change.meal !== "string" || typeof change.change !== "string") return false;
  }
  return typeof value.reason === "string";
}

/** Type-guard: only data matching the stored message structure is restorable. */
export function isStoredChatMessage(value: unknown): value is StoredChatMessage {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || value.id.length === 0) return false;
  if (value.role !== "user" && value.role !== "assistant") return false;
  if (!isNonEmptyString(value.text)) return false;
  if (typeof value.time !== "string") return false;
  if (value.origin !== "chat" && value.origin !== "action") return false;
  if (value.macro !== undefined && !isValidMacro(value.macro)) return false;
  return true;
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
      return null;
    }
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Reads the persisted conversation once (call during client-side init only —
 * never during render/SSR). Invalid entries are dropped; corrupt or missing
 * data falls back to an empty conversation without throwing.
 */
export function readStoredMessages(): StoredChatMessage[] {
  const store = storage();
  if (!store) return [];
  let raw: string | null = null;
  try {
    raw = store.getItem(ASSISTANT_STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isStoredChatMessage);
}

/**
 * Persists the conversation, keeping only the most recent entries.
 * Allow-list pick: hydrated recipe cards (full database documents) and any
 * other non-storable fields are dropped. Silent on failure
 * (quota/unavailable) — chat continues in memory.
 */
export function writeStoredMessages(messages: ReadonlyArray<StoredChatMessage>): void {
  const store = storage();
  if (!store) return;
  try {
    const storable: StoredChatMessage[] = messages.slice(-MAX_STORED_MESSAGES).map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      time: m.time,
      origin: m.origin,
      ...(m.macro !== undefined ? { macro: m.macro } : {}),
    }));
    store.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify(storable));
  } catch {
    // Silent — persistence is best-effort, chat works in memory.
  }
}

/** Removes the persisted conversation (for a future clear-chat action). */
export function clearStoredMessages(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(ASSISTANT_STORAGE_KEY);
  } catch {
    // Silent — see above.
  }
}

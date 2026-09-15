"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles, TrashBin, TriangleExclamation } from "@gravity-ui/icons";
import { AuthGuard } from "@/components/auth";
import { RecipeCard } from "@/components/recipes/recipe-card";
import {
  Alert,
  Badge,
  Button,
  Card,
  DisclaimerBanner,
  Input,
  Spinner,
  TagInput,
  Textarea,
} from "@/components/ui";
import {
  ApiError,
  chatWithAssistant,
  getAssistantRecommendations,
  getMacroAdjustments,
  getPantrySuggestions,
  getRecipe,
} from "@/lib/api";
import { clearStoredMessages, readStoredMessages, writeStoredMessages } from "@/lib/assistant-storage";
import { useAuth } from "@/lib/auth-context";
import type {
  AssistantHistoryTurn,
  AssistantRecommendation,
  MacroAdjustmentResult,
  PantrySuggestion,
  Recipe,
} from "@/lib/types";

const QUICK_PROMPTS = [
  "What can I make with my pantry?",
  "Recommend a high-protein dinner.",
  "Help me use today's remaining calories.",
  "Suggest recipes from my saved recipes.",
  "How can I increase my protein intake?",
] as const;

const HISTORY_WINDOW = 10;

interface CardData {
  recipe: Recipe;
  matchScore?: number;
  reason?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
  cards?: CardData[];
  macro?: MacroAdjustmentResult;
  /**
   * Where the turn came from. Synthetic action turns (Recommend / Suggest /
   * Macro buttons) are display-only — only real `chat` exchanges are sent
   * back as LLM history.
   */
  origin: "chat" | "action";
}

function now(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Hydrates full recipes for recommendation cards. IDs that no longer resolve
 * are reported via `failed` so callers can distinguish "nothing matched" from
 * "loading failed" instead of showing a misleading empty state.
 */
async function hydrateCards(
  items: Array<AssistantRecommendation | PantrySuggestion>,
  opts: { token?: string | null },
): Promise<{ cards: CardData[]; failed: number }> {
  // Dedupe repeat IDs so React keys stay unique downstream.
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    if (seen.has(item.recipeId)) return false;
    seen.add(item.recipeId);
    return true;
  });
  const settled = await Promise.allSettled(
    unique.map(async (item): Promise<CardData> => ({
      recipe: await getRecipe(item.recipeId, opts.token ? { token: opts.token } : {}),
      matchScore: item.matchScore,
      reason: item.reason,
    })),
  );
  return {
    cards: settled
      .filter((r): r is PromiseFulfilledResult<CardData> => r.status === "fulfilled")
      .map((r) => r.value),
    failed: settled.filter((r) => r.status === "rejected").length,
  };
}

export default function AssistantPage() {
  const { token } = useAuth();
  const authOpts = token ? { token } : {};

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pantry, setPantry] = useState<string[]>([]);
  const [calorieTarget, setCalorieTarget] = useState("");
  const [proteinTarget, setProteinTarget] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Guards the persist effect until the one-time restore has run, so the
  // initial empty state never wipes a stored conversation on mount.
  const restoredRef = useRef(false);

  /**
   * Pins the chat container to the latest message — container-only, so the
   * page itself never moves (the old `scrollIntoView({ smooth })` scrolled the
   * whole document and restarted animations mid-flight: the flicker/shake).
   * `if-near-bottom` never yanks scroll while the user reads history.
   *
   * Timing matters: this runs after React commits AND paints (double
   * rAF), because measuring `scrollHeight` in a microtask right after
   * `setMessages` reads the pre-reply layout — React hasn't committed yet —
   * and the snap lands on the old bottom, leaving the reply out of view.
   */
  const snapChatToBottom = (mode: "force" | "if-near-bottom", smooth = false) => {
    Promise.resolve().then(() => {
      const el = listRef.current;
      // Guarded: jsdom (tests) does not implement scrollTo
      if (!el || typeof el.scrollTo !== "function") return;
      if (mode === "if-near-bottom") {
        const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (gap > 160) return;
      }
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    });
  };

  /**
   * Anchors a sent message near the top of the visible chat area so the
   * question stays in view with everything below it (thinking indicator,
   * reply, cards) unfolding underneath. Container-only and smooth; unlike
   * bottom-pinning it never hides the question that triggered the reply.
   * Deferred to post-commit/post-paint (double rAF) so measurements see the
   * committed layout — a microtask can read pre-commit geometry and miss.
   */
  const TOP_OFFSET_PX = 160;
  const scrollSentToTop = (messageId: string) => {
    const run = () => {
      const el = listRef.current;
      if (!el || typeof el.scrollTo !== "function") return;
      const target = el.querySelector(`[data-message-id="${messageId}"]`);
      if (!(target instanceof HTMLElement)) return;
      const delta = target.getBoundingClientRect().top - el.getBoundingClientRect().top;
      el.scrollTo({ top: el.scrollTop + delta - TOP_OFFSET_PX, behavior: "smooth" });
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(run));
    } else {
      Promise.resolve().then(run);
    }
  };

  // Restore once on mount (client-only; initial state stays [] for SSR parity).
  // `snapChatToBottom` is intentionally not a dep: re-running restore on every
  // render would re-read storage and clobber the live conversation.
  useEffect(() => {
    Promise.resolve().then(() => {
      const restored = readStoredMessages();
      if (restored.length > 0) {
        setMessages(restored);
        snapChatToBottom("force");
      }
      restoredRef.current = true;
    });
  }, []);

  // Persist whenever the message list changes — nothing else (draft, loading,
  // targets) triggers a write.
  useEffect(() => {
    if (!restoredRef.current) return;
    writeStoredMessages(messages);
  }, [messages]);

  /**
   * Parses the optional target inputs into backend-valid integers.
   * Returns null (and surfaces an error) when typed text is not a valid
   * whole number — raw Number() would otherwise send NaN/floats/0 and
   * produce avoidable 400s.
   */
  const buildDailyPlan = ():
    | { ok: true; plan?: { calories?: number; proteinGrams?: number } }
    | { ok: false } => {
    // Bounds mirror backend AssistantDailyPlan (calories 1–20000, protein 0–2000)
    const parseTarget = (raw: string, min: number, max: number): number | undefined | "invalid" => {
      if (!raw.trim()) return undefined;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < min || n > max) return "invalid";
      return n;
    };
    const calories = parseTarget(calorieTarget, 1, 20000);
    const protein = parseTarget(proteinTarget, 0, 2000);
    if (calories === "invalid" || protein === "invalid") {
      setError("Targets must be whole numbers — calories 1–20000, protein 0–2000.");
      return { ok: false };
    }
    if (calories === undefined && protein === undefined) return { ok: true };
    return {
      ok: true,
      plan: {
        ...(calories !== undefined ? { calories } : {}),
        ...(protein !== undefined ? { proteinGrams: protein } : {}),
      },
    };
  };

  /** Only real chat exchanges — synthetic action turns would misrepresent intent. */
  const historyFor = (msgs: ChatMessage[]): AssistantHistoryTurn[] =>
    msgs
      .filter((m) => m.origin === "chat")
      .slice(-HISTORY_WINDOW)
      .map((m) => ({ role: m.role, message: m.text.slice(0, 2000) }));

  const handleSend = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    const resolved = buildDailyPlan();
    if (!resolved.ok) return;
    setError(null);
    const userMsg: ChatMessage = { id: newId(), role: "user", text: message, time: now(), origin: "chat" };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setSending(true);
    scrollSentToTop(userMsg.id);
    let revealed = false;
    try {
      const res = await chatWithAssistant(
        {
          message,
          ...(pantry.length > 0 ? { pantryItems: pantry } : {}),
          ...(resolved.plan ? { dailyPlan: resolved.plan } : {}),
          // Prior turns only — the current message travels in `message`
          history: historyFor(messages),
        },
        authOpts,
      );
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", text: res.message, time: now(), origin: "chat" },
      ]);
      // Re-anchor the question up top so the fresh reply unfolds underneath it
      // (skipped on error so the error banner stays visible)
      revealed = true;
      scrollSentToTop(userMsg.id);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Assistant request failed. Please try again.");
    } finally {
      setSending(false);
      if (!revealed) snapChatToBottom("if-near-bottom");
    }
  };

  const handleRecommend = async () => {
    if (sending) return;
    const resolved = buildDailyPlan();
    if (!resolved.ok) return;
    setError(null);
    const userMsg: ChatMessage = {
      id: newId(),
      role: "user",
      text: "Recommend recipes for me.",
      time: now(),
      origin: "action",
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    scrollSentToTop(userMsg.id);
    let revealed = false;
    try {
      const res = await getAssistantRecommendations(
        {
          ...(pantry.length > 0 ? { pantryItems: pantry } : {}),
          ...(resolved.plan ? { dailyPlan: resolved.plan } : {}),
        },
        authOpts,
      );
      const { cards, failed } = await hydrateCards(res.recommendations, { token });
      if (cards.length === 0 && res.recommendations.length > 0) {
        // All detail loads failed — say so instead of "nothing fits".
        setError("Recommendations arrived but their details could not be loaded. Please try again.");
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          text:
            cards.length > 0
              ? `I found ${cards.length} recipe${cards.length === 1 ? "" : "s"} that fit your profile.${failed > 0 ? ` (${failed} more could not be loaded.)` : ""}`
              : "Nothing in the current collection fits your profile and allergies right now — try broadening your pantry or preferences.",
          time: now(),
          origin: "action",
          cards,
        },
      ]);
      revealed = true;
      scrollSentToTop(userMsg.id);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Recommendations failed. Please try again.");
    } finally {
      setSending(false);
      if (!revealed) snapChatToBottom("if-near-bottom");
    }
  };

  const handlePantrySuggest = async () => {
    if (sending || pantry.length === 0) {
      if (pantry.length === 0) setError("Add at least one pantry item first.");
      return;
    }
    setError(null);
    const preview = pantry.slice(0, 5).join(", ");
    const remainder = pantry.length > 5 ? `, and ${pantry.length - 5} more` : "";
    const userMsg: ChatMessage = {
      id: newId(),
      role: "user",
      text: `What can I make with ${preview}${remainder}?`,
      time: now(),
      origin: "action",
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    scrollSentToTop(userMsg.id);
    let revealed = false;
    try {
      const res = await getPantrySuggestions({ pantryItems: pantry }, authOpts);
      const { cards, failed } = await hydrateCards(res.suggestions, { token });
      if (cards.length === 0 && res.suggestions.length > 0) {
        // All detail loads failed — say so instead of "no matches".
        setError("Matches were found but their details could not be loaded. Please try again.");
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          text:
            cards.length > 0
              ? `Based on your pantry, these ${cards.length} recipe${cards.length === 1 ? "" : "s"} match best.${failed > 0 ? ` (${failed} more could not be loaded.)` : ""}`
              : "No published recipes match those pantry items yet — try adding a staple like rice, eggs, or chicken.",
          time: now(),
          origin: "action",
          cards,
        },
      ]);
      revealed = true;
      scrollSentToTop(userMsg.id);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Pantry suggestions failed. Please try again.");
    } finally {
      setSending(false);
      if (!revealed) snapChatToBottom("if-near-bottom");
    }
  };

  const handleMacroAdjust = async () => {
    if (sending) return;
    const reqText = draft.trim() || "Suggest adjustments to help meet my targets.";
    const resolved = buildDailyPlan();
    if (!resolved.ok) return;
    setError(null);
    const userMsg: ChatMessage = { id: newId(), role: "user", text: reqText, time: now(), origin: "action" };
    setMessages((prev) => [...prev, userMsg]);
    setDraft("");
    setSending(true);
    scrollSentToTop(userMsg.id);
    let revealed = false;
    try {
      const macro = await getMacroAdjustments(
        {
          request: reqText,
          ...(resolved.plan ? { dailyPlan: resolved.plan } : {}),
        },
        authOpts,
      );
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          text: macro.reason,
          time: now(),
          origin: "action",
          macro,
        },
      ]);
      revealed = true;
      scrollSentToTop(userMsg.id);
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Macro adjustment failed. Please try again.");
    } finally {
      setSending(false);
      if (!revealed) snapChatToBottom("if-near-bottom");
    }
  };

  /**
   * Clears the visible conversation and removes the persisted session copy.
   * In-flight replies (if any) still append when they arrive — clearing never
   * breaks an ongoing request.
   */
  const handleClearChat = () => {
    setMessages([]);
    setError(null);
    clearStoredMessages();
  };

  return (
    <AuthGuard message="Sign in to chat with your personalized Food & Nutrition Assistant.">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 space-y-2 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3.5 py-1 text-xs font-semibold text-primary-strong">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>Food &amp; Nutrition Assistant</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-heading sm:text-4xl">
            Your personalized AI food companion
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-subtle-foreground">
            Answers use your saved recipes, dietary preferences, allergies, and targets — never
            general knowledge alone.
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <Alert variant="danger">
              <div className="flex items-center gap-2">
                <TriangleExclamation className="size-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            </Alert>
          </div>
        )}

        {/* Context inputs */}
        <Card className="mb-4 space-y-4 p-4 sm:p-5">
          <TagInput
            label="My pantry (optional)"
            placeholder="e.g. chicken — press Enter to add"
            hint="Sent with chat and recipe suggestions so answers can use what you have."
            value={pantry}
            onChange={setPantry}
            disabled={sending}
            maxTags={50}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Daily calorie target (optional)"
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="e.g. 2300"
              value={calorieTarget}
              onChange={(e) => setCalorieTarget(e.target.value)}
              disabled={sending}
            />
            <Input
              label="Daily protein target in g (optional)"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="e.g. 120"
              value={proteinTarget}
              onChange={(e) => setProteinTarget(e.target.value)}
              disabled={sending}
            />
          </div>
        </Card>

        {/* Chat area */}
        <Card className="p-4 sm:p-5">
          <div
            ref={listRef}
            className="max-h-125 space-y-4 overflow-y-auto [overflow-anchor:none]"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm font-medium text-heading">Start with a suggestion:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={sending}
                      onClick={() => void handleSend(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} data-message-id={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary-strong px-4 py-2.5 text-sm leading-relaxed text-white">
                    <p>{msg.text}</p>
                    <p className="mt-1 text-right text-[11px] text-white/70">{msg.time}</p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[92%] space-y-3 rounded-2xl rounded-bl-md border border-border bg-background px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-primary-strong" aria-hidden="true" />
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Assistant · {msg.time}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {msg.text}
                    </p>
                    {msg.cards && msg.cards.length > 0 && (
                      <div className="grid gap-3 pt-1 sm:grid-cols-2">
                        {msg.cards.map((card, i) => (
                          <RecipeCard
                            key={`${card.recipe.id}-${i}`}
                            recipe={card.recipe}
                            matchScore={card.matchScore}
                            matchReason={card.reason}
                          />
                        ))}
                      </div>
                    )}
                    {msg.macro && (
                      <div className="space-y-2 rounded-xl border border-border bg-card p-3">
                        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                          {(
                            [
                              ["Calories", `${msg.macro.recommendation.calories} kcal`],
                              ["Protein", `${msg.macro.recommendation.proteinGrams} g`],
                              ["Carbs", `${msg.macro.recommendation.carbohydratesGrams} g`],
                              ["Fat", `${msg.macro.recommendation.fatGrams} g`],
                            ] as const
                          ).map(([label, value]) => (
                            <div key={label} className="rounded-lg bg-background px-2 py-1.5">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {label}
                              </p>
                              <p className="text-sm font-bold text-heading">{value}</p>
                            </div>
                          ))}
                        </div>
                        {msg.macro.changes.length > 0 && (
                          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                            {msg.macro.changes.map((c, i) => (
                              <li key={`${c.meal}-${i}`}>
                                <span className="font-semibold">{c.meal}:</span> {c.change}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>

          {/* Thinking indicator lives OUTSIDE the scrollable message list so the
              list DOM stays completely static while a request is in flight —
              no mount/unmount or animation adjacent to the bubbles. */}
          {sending && (
            <div
              className="flex min-h-6 items-center gap-2 px-1 pt-3 text-sm text-subtle-foreground"
              role="status"
            >
              <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                <Spinner className="size-4" />
              </span>
              <span>Assistant is thinking…</span>
            </div>
          )}

          {/* Composer */}
          <form
            className="mt-4 flex items-end gap-2 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend(draft);
            }}
          >
            <div className="flex-1">
              <Textarea
                label="Ask the assistant"
                rows={2}
                placeholder="Ask about recipes, pantry, protein, calories…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={sending}
              />
            </div>
            <Button type="submit" disabled={sending || !draft.trim()} aria-label="Send message">
              <ArrowRight className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={sending} onClick={() => void handleRecommend()}>
              Recommend recipes
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sending || pantry.length === 0}
              title={pantry.length === 0 ? "Add pantry items first" : undefined}
              onClick={() => void handlePantrySuggest()}
            >
              Suggest from pantry
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={sending}
              title="Uses the composer text (or a default prompt) plus your targets above"
              onClick={() => void handleMacroAdjust()}
            >
              Adjust macros
            </Button>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                title="Clear this conversation (session-only, cannot be undone)"
                onClick={handleClearChat}
              >
                <TrashBin className="size-3.5" aria-hidden="true" />
                <span>Clear chat</span>
              </Button>
            )}
            {messages.length > 0 && (
              <Badge variant="neutral" className="ml-auto self-center">
                {messages.length} message{messages.length === 1 ? "" : "s"}
              </Badge>
            )}
          </div>
        </Card>

        <div className="mt-4 space-y-3">
          <DisclaimerBanner kind="nutrition" />
          <DisclaimerBanner kind="allergy">
            The assistant respects your stored allergies on a best-effort basis — always verify
            ingredients independently.
          </DisclaimerBanner>
        </div>
      </div>
    </AuthGuard>
  );
}

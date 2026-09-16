import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ASSISTANT_STORAGE_KEY,
  MAX_STORED_MESSAGES,
  clearStoredMessages,
  isStoredChatMessage,
  readStoredMessages,
  writeStoredMessages,
  type StoredChatMessage,
} from "../src/lib/assistant-storage";

function makeMessage(overrides: Partial<StoredChatMessage> = {}): StoredChatMessage {
  return {
    id: "msg-1",
    role: "user",
    text: "What can I make with chicken?",
    time: "10:00",
    origin: "chat",
    ...overrides,
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("assistant-storage — key conventions", () => {
  it("uses a namespaced flavorai_ key and a bounded history", () => {
    expect(ASSISTANT_STORAGE_KEY).toBe("flavorai_ai_assistant_messages");
    expect(MAX_STORED_MESSAGES).toBeGreaterThan(0);
  });
});

describe("isStoredChatMessage — validation", () => {
  it("accepts a well-formed message with optional macro", () => {
    expect(
      isStoredChatMessage({
        ...makeMessage(),
        macro: {
          recommendation: { calories: 2250, proteinGrams: 150, carbohydratesGrams: 220, fatGrams: 65 },
          changes: [{ meal: "Lunch", change: "More chicken" }],
          reason: "More protein.",
        },
      }),
    ).toBe(true);
  });

  it.each([
    ["null", null],
    ["string", "hello"],
    ["array", []],
    ["missing id", { ...makeMessage(), id: undefined }],
    ["bad role", { ...makeMessage(), role: "system" }],
    ["empty text", { ...makeMessage(), text: "" }],
    ["oversized text", { ...makeMessage(), text: "x".repeat(10001) }],
    ["bad origin", { ...makeMessage(), origin: "stream" }],
    ["malformed macro", { ...makeMessage(), macro: { recommendation: { calories: "lots" } } }],
  ])("rejects %s", (_label, value) => {
    expect(isStoredChatMessage(value)).toBe(false);
  });
});

describe("readStoredMessages — safe restore", () => {
  it("returns [] when the key is missing", () => {
    expect(readStoredMessages()).toEqual([]);
  });

  it("returns [] for invalid JSON without throwing", () => {
    window.sessionStorage.setItem(ASSISTANT_STORAGE_KEY, "not-json{{{");
    expect(readStoredMessages()).toEqual([]);
  });

  it("returns [] for non-array payloads", () => {
    window.sessionStorage.setItem(ASSISTANT_STORAGE_KEY, JSON.stringify({ messages: [] }));
    expect(readStoredMessages()).toEqual([]);
  });

  it("keeps valid entries and drops invalid ones", () => {
    window.sessionStorage.setItem(
      ASSISTANT_STORAGE_KEY,
      JSON.stringify([makeMessage({ id: "a" }), { role: "user" }, makeMessage({ id: "b" })]),
    );
    expect(readStoredMessages().map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("writeStoredMessages — bounded, card-stripped writes", () => {
  it("round-trips messages and strips hydrated cards", () => {
    const withCards = { ...makeMessage(), cards: [{ recipe: { id: "r1" } }] };
    writeStoredMessages([withCards]);
    const restored = readStoredMessages();
    expect(restored).toHaveLength(1);
    expect(restored[0]).not.toHaveProperty("cards");
    expect(restored[0]).toMatchObject({ id: "msg-1", text: "What can I make with chicken?" });
  });

  it("keeps only the most recent messages", () => {
    const many = Array.from({ length: MAX_STORED_MESSAGES + 10 }, (_, i) =>
      makeMessage({ id: `m-${i}`, text: `message ${i}` }),
    );
    writeStoredMessages(many);
    const restored = readStoredMessages();
    expect(restored).toHaveLength(MAX_STORED_MESSAGES);
    expect(restored[0].id).toBe("m-10");
    expect(restored[restored.length - 1].id).toBe(`m-${MAX_STORED_MESSAGES + 9}`);
  });

  it("does not throw when storage writes fail (quota/unavailable)", () => {
    vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    expect(() => writeStoredMessages([makeMessage()])).not.toThrow();
  });
});

describe("clearStoredMessages", () => {
  it("removes the key", () => {
    writeStoredMessages([makeMessage()]);
    clearStoredMessages();
    expect(window.sessionStorage.getItem(ASSISTANT_STORAGE_KEY)).toBeNull();
    expect(readStoredMessages()).toEqual([]);
  });
});

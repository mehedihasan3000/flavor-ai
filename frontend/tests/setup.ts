import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined") {
  const storageMap = new Map<string, string>();
  const mockStorage: Storage = {
    length: 0,
    clear: () => {
      storageMap.clear();
      (mockStorage as unknown as { length: number }).length = 0;
    },
    getItem: (key: string) => storageMap.get(key) ?? null,
    key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
    removeItem: (key: string) => {
      storageMap.delete(key);
      (mockStorage as unknown as { length: number }).length = storageMap.size;
    },
    setItem: (key: string, value: string) => {
      storageMap.set(key, String(value));
      (mockStorage as unknown as { length: number }).length = storageMap.size;
    },
  };

  try {
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  } catch {
    // fallback if defineProperty fails
  }
}
if (!window.localStorage || typeof window.localStorage.setItem !== "function") {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
}


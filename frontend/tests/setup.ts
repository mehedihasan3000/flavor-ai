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

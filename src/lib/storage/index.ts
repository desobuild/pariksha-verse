import type { StorageAdapter } from "./types";
import { BrowserStorageAdapter } from "./browser-storage";
import { MemoryStorageAdapter } from "./memory-storage";
import { IndexedDBStorageAdapter } from "./indexeddb-storage";

export * from "./types";
export * from "./browser-storage";
export * from "./memory-storage";
export * from "./indexeddb-storage";

export function createStorage(type?: "indexeddb" | "browser" | "memory"): StorageAdapter {
  if (type === "memory") {
    return new MemoryStorageAdapter();
  }
  if (type === "browser") {
    return new BrowserStorageAdapter();
  }
  if (type === "indexeddb") {
    return new IndexedDBStorageAdapter();
  }
  if (typeof window !== "undefined") {
    if (typeof window.indexedDB !== "undefined" && window.indexedDB !== null) {
      return new IndexedDBStorageAdapter();
    }
    return new BrowserStorageAdapter();
  }
  return new MemoryStorageAdapter();
}

/**
 * Default global storage adapter instance.
 * Automatically selects IndexedDB in modern browsers, LocalStorage as fallback, and MemoryStorage on server/SSR.
 */
export const appStorage: StorageAdapter = createStorage();


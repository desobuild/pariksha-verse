import type { StorageAdapter } from "./types";
import { BrowserStorageAdapter } from "./browser-storage";
import { MemoryStorageAdapter } from "./memory-storage";

export * from "./types";
export * from "./browser-storage";
export * from "./memory-storage";

export function createStorage(type?: "browser" | "memory"): StorageAdapter {
  if (type === "memory") {
    return new MemoryStorageAdapter();
  }
  if (typeof window !== "undefined") {
    return new BrowserStorageAdapter();
  }
  return new MemoryStorageAdapter();
}

/**
 * Default global storage adapter instance.
 * Automatically selects BrowserStorage in the browser and MemoryStorage on server/SSR.
 */
export const appStorage: StorageAdapter = createStorage();

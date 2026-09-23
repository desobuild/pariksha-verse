import { describe, it, expect, beforeEach } from "vitest";
import { IndexedDBStorageAdapter } from "@/lib/storage/indexeddb-storage";
import { createStorage } from "@/lib/storage";

describe("IndexedDB Storage Adapter & Storage Factory", () => {
  let adapter: IndexedDBStorageAdapter;

  beforeEach(() => {
    adapter = new IndexedDBStorageAdapter("test_pv:");
  });

  it("handles environment without window.indexedDB gracefully by returning null/empty", async () => {
    // In Node.js / SSR environment where window.indexedDB is undefined
    const val = await adapter.getItem("test_key");
    expect(val).toBeNull();

    await expect(adapter.setItem("test_key", { data: 1 })).resolves.toBeUndefined();
    await expect(adapter.removeItem("test_key")).resolves.toBeUndefined();
    await expect(adapter.clear()).resolves.toBeUndefined();

    const keys = await adapter.getAllKeys();
    expect(keys).toEqual([]);
  });

  it("createStorage automatically falls back to MemoryStorage on SSR/Node", () => {
    const storage = createStorage();
    expect(storage).toBeDefined();
    expect(typeof storage.getItem).toBe("function");
    expect(typeof storage.setItem).toBe("function");
  });

  it("createStorage explicitly returns MemoryStorageAdapter when requested", async () => {
    const storage = createStorage("memory");
    await storage.setItem("key_1", "value_1");
    const retrieved = await storage.getItem("key_1");
    expect(retrieved).toBe("value_1");

    const allKeys = await storage.getAllKeys();
    expect(allKeys).toContain("key_1");

    await storage.removeItem("key_1");
    expect(await storage.getItem("key_1")).toBeNull();
  });
});

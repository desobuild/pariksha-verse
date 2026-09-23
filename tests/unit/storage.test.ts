import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage";
import { BrowserStorageAdapter } from "@/lib/storage/browser-storage";

describe("Storage Adapter Abstraction", () => {
  describe("MemoryStorageAdapter", () => {
    let storage: MemoryStorageAdapter;

    beforeEach(() => {
      storage = new MemoryStorageAdapter();
    });

    it("sets, gets, removes, and clears items accurately", async () => {
      expect(await storage.getItem("test-key")).toBeNull();

      await storage.setItem("test-key", { exam: "NEET", year: 2026 });
      const value = await storage.getItem<{ exam: string; year: number }>("test-key");
      expect(value).toEqual({ exam: "NEET", year: 2026 });

      const keys = await storage.getAllKeys();
      expect(keys).toContain("test-key");

      await storage.removeItem("test-key");
      expect(await storage.getItem("test-key")).toBeNull();

      await storage.setItem("key-1", 1);
      await storage.setItem("key-2", 2);
      await storage.clear();
      expect(await storage.getAllKeys()).toHaveLength(0);
    });
  });

  describe("BrowserStorageAdapter in simulated browser", () => {
    let storage: BrowserStorageAdapter;

    beforeEach(() => {
      window.localStorage.clear();
      storage = new BrowserStorageAdapter("test-pv:");
    });

    it("persists items through localStorage with namespace prefix", async () => {
      await storage.setItem("user-pref", { darkMode: true });
      const stored = await storage.getItem<{ darkMode: boolean }>("user-pref");
      expect(stored).toEqual({ darkMode: true });

      const keys = await storage.getAllKeys();
      expect(keys).toContain("user-pref");

      await storage.removeItem("user-pref");
      expect(await storage.getItem("user-pref")).toBeNull();
    });
  });
});

import type { StorageAdapter } from "./types";

export class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, unknown>();

  async getItem<T>(key: string): Promise<T | null> {
    if (!this.store.has(key)) return null;
    return this.store.get(key) as T;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

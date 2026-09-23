import type { StorageAdapter } from "./types";

export class BrowserStorageAdapter implements StorageAdapter {
  private prefix: string;

  constructor(prefix = "pv:") {
    this.prefix = prefix;
  }

  private isAvailable(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }

  async getItem<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;

    try {
      const raw = window.localStorage.getItem(`${this.prefix}${key}`);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const raw = JSON.stringify(value);
      window.localStorage.setItem(`${this.prefix}${key}`, raw);
    } catch {
      // Ignore quota exceeded or storage disabled errors gracefully
    }
  }

  async removeItem(key: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      window.localStorage.removeItem(`${this.prefix}${key}`);
    } catch {
      // Ignore
    }
  }

  async clear(): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        window.localStorage.removeItem(k);
      }
    } catch {
      // Ignore
    }
  }

  async getAllKeys(): Promise<string[]> {
    if (!this.isAvailable()) return [];

    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(this.prefix)) {
          keys.push(k.slice(this.prefix.length));
        }
      }
      return keys;
    } catch {
      return [];
    }
  }
}

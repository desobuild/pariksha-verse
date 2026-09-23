import type { StorageAdapter } from "./types";

const DB_NAME = "pariksha_verse_db";
const DB_VERSION = 1;
const STORE_NAME = "keyvalue";

/**
 * StorageAdapter implementation backed by browser IndexedDB.
 * Used for persistent, quota-resilient guest mode data storage.
 */
export class IndexedDBStorageAdapter implements StorageAdapter {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private prefix: string;

  constructor(prefix = "pv:") {
    this.prefix = prefix;
  }

  private isAvailable(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.indexedDB !== "undefined" &&
      window.indexedDB !== null
    );
  }

  private getDB(): Promise<IDBDatabase | null> {
    if (!this.isAvailable()) {
      return Promise.resolve(null);
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  async getItem<T>(key: string): Promise<T | null> {
    const db = await this.getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(`${this.prefix}${key}`);

        req.onsuccess = () => {
          resolve(req.result !== undefined ? (req.result as T) : null);
        };

        req.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, `${this.prefix}${key}`);

        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async removeItem(key: string): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(`${this.prefix}${key}`);

        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.openKeyCursor();

        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const keyStr = String(cursor.key);
            if (keyStr.startsWith(this.prefix)) {
              store.delete(cursor.key);
            }
            cursor.continue();
          } else {
            resolve();
          }
        };

        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async getAllKeys(): Promise<string[]> {
    const db = await this.getDB();
    if (!db) return [];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAllKeys();

        req.onsuccess = () => {
          const keys = (req.result || [])
            .map(String)
            .filter((k) => k.startsWith(this.prefix))
            .map((k) => k.slice(this.prefix.length));
          resolve(keys);
        };

        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }
}

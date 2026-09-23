/**
 * StorageAdapter interface establishing clean abstraction for workspace persistence.
 * Prevents React components from directly touching localStorage or IndexedDB.
 * Supports switching between browser local storage, in-memory mock, and future encrypted Cloud storage.
 */
export interface StorageAdapter {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
}

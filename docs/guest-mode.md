# ParikshaVerse — Guest Mode Architecture (Phase 3)

This document formalizes the principles, lifecycle, storage mechanism, and identity model for ParikshaVerse's Guest Mode.

---

## 1. Product Principles

1. **Zero-Barrier Preparation**:
   Students can begin preparing for competitive exams (NEET, JEE) instantly upon opening the application. No mandatory signup screens, no forced phone number verifications, and no account walls.
2. **Uncompromised Local Experience**:
   Guest mode is not a degraded or feature-restricted demo. Guests have access to the full preparation domain: active exam workspaces, syllabus tracking, study planner tasks, focus timers, spaced repetition revisions, and mock test scores.
3. **Data Stays on Device**:
   All guest data resides strictly on the student's device in browser IndexedDB. No guest preparation data is uploaded to remote servers until the student explicitly chooses to create an account or sign in.
4. **Privacy by Default**:
   Guest mode uses zero device fingerprinting, zero IP tracking, and zero behavioral telemetry.

---

## 2. Guest Identity Model

A stable local identity is generated on first launch:

```typescript
export interface GuestIdentity {
  id: string;        // crypto.randomUUID()
  createdAt: number; // Unix timestamp in milliseconds
}
```

### Characteristics
- **Cryptographically Random**: Generated using standard `crypto.randomUUID()`.
- **Local Persistence**: Stored in client storage under `pv:guest_identity`.
- **Session Stability**: Remains identical across browser tab closures, page reloads, and PWA restarts.
- **Device Scoped**: Bound to the specific browser storage instance.
- **Self-Healing**: If stored guest identity data is corrupted or tampered with, it is discarded safely and a fresh valid identity is generated without crashing the UI.

---

## 3. Storage Layer: IndexedDB Storage Adapter

Guest domain records are persisted using `IndexedDBStorageAdapter`, which implements the unified `StorageAdapter` interface established in Phase 1:

```typescript
export interface StorageAdapter {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
}
```

### Storage Configuration
- **Database Name**: `pariksha_verse_db`
- **Object Store**: `keyvalue`
- **Prefix**: `pv:`
- **Key Convention**:
  - Workspaces: `pv:guest:workspaces`
  - Topic Progress: `pv:guest:topic_progress`
  - Planner Tasks: `pv:guest:planner_tasks`
  - Study Sessions: `pv:guest:study_sessions`
  - Revision Items: `pv:guest:revision_items`
  - Practice Sessions: `pv:guest:practice_sessions`
  - Saved Resources: `pv:guest:saved_resources`
  - Mock Tests: `pv:guest:mock_tests`
  - Mock Results: `pv:guest:mock_test_results`
  - User Preferences: `pv:guest:user_preferences`
  - Notification Preferences: `pv:guest:notification_preferences`

---

## 4. Domain Repositories & UI Decoupling

UI components consume repositories via the `useRepositories()` hook:

```
        React Components (e.g. Study, Planner, Progress)
                           │
                           ▼
                   useRepositories()
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    Guest Mode Active          Authenticated Active
             │                           │
             ▼                           ▼
   GuestRepositories          AuthenticatedRepositories
   (IndexedDB Storage)         (Server API Boundary)
```

**Feature code never contains `if (isGuest)` branching.** Repositories expose identical domain methods regardless of whether storage is local or cloud-backed.

---

## 5. Cross-Device Behavior

- **Device A (Guest)**: Progress is stored locally in Device A's IndexedDB.
- **Device B (Guest)**: Progress is stored locally in Device B's IndexedDB.
- **Account Linking**: When a student signs into their account on Device A, local progress from Device A is automatically migrated to Cloudflare D1. When the student subsequently signs into Device B, their synced cloud preparation workspace is loaded immediately.

# ParikshaVerse — Guest → Account Data Migration (Phase 3)

This document details the deterministic, idempotent migration pipeline that transfers local guest preparation records into an authenticated Cloudflare D1 account.

---

## 1. High-Level Migration Flow

```
Guest Mode on Device (IndexedDB)
  │
  │  1. Student creates account or signs in
  ▼
Auth Context triggers `migrateGuestData(userId)`
  │
  ├── 2. Reads local `GuestMigrationState`
  │      • If already 'completed' for this userId: exits immediately (idempotent)
  │
  ├── 3. Sets state: `status = "in_progress"`
  │
  ├── 4. Extracts all guest records from IndexedDB
  │
  ▼
POST /api/auth/migrate (Authenticated HTTP Request)
  │
  ├── 5. Server validates HttpOnly session cookie -> derives `userId`
  ├── 6. Executes deterministic conflict resolution in Cloudflare D1
  └── 7. Returns 200 OK with migration summary
  │
  ▼
Client Finalization
  ├── 8. Sets state: `status = "completed"`, `completedAt = now`
  └── 9. Safely purges local guest domain records from IndexedDB
```

---

## 2. Deterministic Conflict Resolution Matrix

When an authenticated user account already contains existing preparation records, guest data is merged according to explicit, deterministic rules:

| Entity | Conflict Scenario | Resolution Rule |
| :--- | :--- | :--- |
| **Workspace** | Authenticated user already has workspace for the same `examAttemptId`. | **Merge**: Reuses existing authenticated `workspace.id`. Guest workspace children are re-linked to this ID rather than creating duplicate workspaces. |
| **Topic Progress** | Existing progress record for `(workspaceId, topicId)`. | **Hierarchical Status Promotion**: Status advances to the highest stage achieved: `not_started` < `learning` < `learned` < `practiced` < `revised` < `mastered`.<br/>**Sum Counts**: `practiceAttempts = existing + guest`, `correct = existing + guest`, `incorrect = existing + guest`.<br/>**Accuracy Recalculation**: `round((correct / (correct + incorrect)) * 10000)` in basis points.<br/>**Timestamps**: `lastStudiedAt = max(existing, guest)`, `lastRevisedAt = max(existing, guest)`.<br/>**Notes**: Preserves authenticated notes and appends guest notes if distinct. |
| **Planner Tasks** | Task exists with matching `(workspaceId, title, scheduledDate)`. | **Deduplicate**: Skips duplicate task to prevent double-scheduling. |
| **Study Sessions** | Historical study timer event. | **Historical Preservation**: Inserts session records, deduplicating matching session IDs. |
| **Revision Items** | Existing item for `(workspaceId, topicId)`. | **Deduplicate**: Preserves existing scheduled spaced repetition item. |
| **Practice Sessions** | Question practice session. | **Historical Preservation**: Inserts session performance logs, deduplicating matching IDs. |
| **Saved Resources** | Bookmark for `(workspaceId, resourceId)`. | **Idempotent**: `ON CONFLICT DO NOTHING` on unique `(workspace_id, resource_id)`. |
| **Mock Tests & Results** | Mock test event and result score. | **Deduplicate**: Preserves existing tests by matching test ID. |
| **Preferences** | User and notification preferences. | **Conditional**: Merges only if the authenticated user has not set custom preferences. |

---

## 3. Idempotency & Failure Recovery

### Safe Failure Handling
1. **Never Purge Early**: Local guest records in IndexedDB are **never deleted** before the server confirms 200 OK.
2. **Network Failures**: If connection drops or the server returns an error:
   - Migration state is marked `status = "failed"` with the error message.
   - All guest data remains completely untouched on the device.
   - Next app launch or sign-in will automatically retry the migration.

### Idempotency Guarantee
Running `migrateGuestData()` once, twice, or multiple times produces identical state without duplicate records:
- Server checks unique constraints and existing records before inserting.
- If called for a user whose migration has already succeeded, the client skips processing immediately.

---

## 4. Client Migration State Machine

Stored locally in IndexedDB under `pv:guest_migration_state`:

```typescript
export interface GuestMigrationState {
  status: "idle" | "pending" | "in_progress" | "completed" | "failed";
  authenticatedUserId: string | null;
  startedAt: number | null;
  completedAt: number | null;
  error?: string;
}
```

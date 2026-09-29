import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage";
import type { StorageAdapter } from "@/lib/storage/types";
import {
  migrateGuestData,
  getGuestMigrationState,
  setGuestMigrationState,
} from "@/lib/auth/guest-migration";
import { GUEST_STORAGE_KEYS } from "@/repositories/guest-repositories";
import type { MigrationSummary } from "@/lib/auth/auth-types";

/**
 * Client-side guest → account migration lifecycle:
 * success, failure handling, idempotent skip, interrupted-request retry
 * (immediate post-auth navigation), and revision-schedule payload safety.
 */

const USER_ID = "usr_client_migration_test";

const ZERO_SUMMARY: MigrationSummary = {
  workspacesMigrated: 0,
  topicProgressMigrated: 0,
  plannerTasksMigrated: 0,
  studySessionsMigrated: 0,
  revisionItemsMigrated: 0,
  practiceSessionsMigrated: 0,
  savedResourcesMigrated: 0,
  mockTestsMigrated: 0,
  mockTestResultsMigrated: 0,
};

function okFetchResponse(summary: Partial<MigrationSummary> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, summary: { ...ZERO_SUMMARY, ...summary } }),
  };
}

/** Seeds a representative guest data set: workspace + progress + revision schedule. */
async function seedGuestData(storage: StorageAdapter): Promise<void> {
  await storage.setItem(GUEST_STORAGE_KEYS.WORKSPACES, [
    { id: "guest_ws_1", examAttemptId: "attempt_neet_2027", isActive: true },
  ]);
  await storage.setItem(GUEST_STORAGE_KEYS.TOPIC_PROGRESS, [
    {
      workspaceId: "guest_ws_1",
      topicId: "top_mendel",
      status: "learned",
      nextRevisionAt: "2026-10-05T00:00:00.000Z",
    },
  ]);
  await storage.setItem(GUEST_STORAGE_KEYS.REVISION_ITEMS, [
    {
      workspaceId: "guest_ws_1",
      topicId: "top_mendel",
      revisionNumber: 1,
      nextRevisionAt: "2026-10-05T00:00:00.000Z",
      status: "scheduled",
    },
  ]);
}

let storage: MemoryStorageAdapter;
let fetchMock: ReturnType<typeof vi.fn>;

describe("Guest migration client lifecycle", () => {
  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("migrates successfully: posts payload, marks completed, clears guest data", async () => {
    await seedGuestData(storage);
    fetchMock.mockResolvedValue(okFetchResponse({ workspacesMigrated: 1, revisionItemsMigrated: 1 }));

    const result = await migrateGuestData(USER_ID, storage);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/migrate");
    expect(init.method).toBe("POST");
    const payload = JSON.parse(String(init.body));
    expect(payload.workspaces).toHaveLength(1);
    expect(payload.revisionItems).toHaveLength(1);
    // The revision schedule survives payload extraction untouched
    expect(payload.revisionItems[0].nextRevisionAt).toBe("2026-10-05T00:00:00.000Z");
    expect(payload.topicProgress[0].nextRevisionAt).toBe("2026-10-05T00:00:00.000Z");

    const state = await getGuestMigrationState(storage);
    expect(state.status).toBe("completed");
    expect(state.authenticatedUserId).toBe(USER_ID);

    // Local guest data is only cleared after server confirmation
    expect(await storage.getItem(GUEST_STORAGE_KEYS.WORKSPACES)).toBeNull();
    expect(await storage.getItem(GUEST_STORAGE_KEYS.TOPIC_PROGRESS)).toBeNull();
    expect(await storage.getItem(GUEST_STORAGE_KEYS.REVISION_ITEMS)).toBeNull();
  });

  it("keeps guest data and marks retryable state when the server fails", async () => {
    await seedGuestData(storage);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "Migration processing failed on server." }),
    });

    const result = await migrateGuestData(USER_ID, storage);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Migration processing failed");

    const state = await getGuestMigrationState(storage);
    expect(state.status).toBe("failed");
    expect(state.authenticatedUserId).toBe(USER_ID);

    // Nothing is lost: local records are intact for the next attempt
    expect(await storage.getItem(GUEST_STORAGE_KEYS.WORKSPACES)).toHaveLength(1);
    expect(await storage.getItem(GUEST_STORAGE_KEYS.REVISION_ITEMS)).toHaveLength(1);
  });

  it("skips re-migration when already completed for the same user", async () => {
    await setGuestMigrationState(
      {
        status: "completed",
        authenticatedUserId: USER_ID,
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
      },
      storage
    );

    const result = await migrateGuestData(USER_ID, storage);

    expect(result.success).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("survives an aborted request (immediate post-auth navigation) and retries on the next attempt", async () => {
    await seedGuestData(storage);

    // First attempt: the full-page navigation right after sign-in aborts the
    // in-flight migrate POST, exactly as a browser would.
    fetchMock.mockRejectedValueOnce(new DOMException("The user aborted a request.", "AbortError"));

    const first = await migrateGuestData(USER_ID, storage);
    expect(first.success).toBe(false);

    const failedState = await getGuestMigrationState(storage);
    expect(failedState.status).toBe("failed");
    // Guest data survives the aborted attempt
    expect(await storage.getItem(GUEST_STORAGE_KEYS.WORKSPACES)).toHaveLength(1);
    expect(await storage.getItem(GUEST_STORAGE_KEYS.REVISION_ITEMS)).toHaveLength(1);

    // Second attempt (the page-load retry path) completes the migration.
    // The server-side merge is idempotent, so the retry cannot duplicate rows.
    fetchMock.mockResolvedValueOnce(okFetchResponse());

    const second = await migrateGuestData(USER_ID, storage);
    expect(second.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const state = await getGuestMigrationState(storage);
    expect(state.status).toBe("completed");
    expect(await storage.getItem(GUEST_STORAGE_KEYS.WORKSPACES)).toBeNull();
    expect(await storage.getItem(GUEST_STORAGE_KEYS.REVISION_ITEMS)).toBeNull();
  });

  it("does not short-circuit when only non-workspace collections hold data", async () => {
    // Revision-only guest data: previously the hasData check ignored these
    // collections and marked the migration complete without ever posting.
    await storage.setItem(GUEST_STORAGE_KEYS.REVISION_ITEMS, [
      {
        workspaceId: "guest_ws_1",
        topicId: "top_mendel",
        revisionNumber: 1,
        nextRevisionAt: "2026-10-05T00:00:00.000Z",
        status: "scheduled",
      },
    ]);
    fetchMock.mockResolvedValue(okFetchResponse());

    const result = await migrateGuestData(USER_ID, storage);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.revisionItems).toHaveLength(1);
  });

  it("marks completed without a request when the guest has no data at all", async () => {
    const result = await migrateGuestData(USER_ID, storage);

    expect(result.success).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    const state = await getGuestMigrationState(storage);
    expect(state.status).toBe("completed");
  });
});

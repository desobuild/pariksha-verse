import type { StorageAdapter } from "@/lib/storage/types";
import { appStorage } from "@/lib/storage";
import { GUEST_STORAGE_KEYS } from "@/repositories/guest-repositories";
import type {
  GuestMigrationState,
  GuestMigrationPayload,
  MigrationSummary,
} from "./auth-types";
import { getOrCreateGuestIdentity } from "./guest-identity";

export const MIGRATION_STATE_KEY = "guest_migration_state";

export async function getGuestMigrationState(
  storage: StorageAdapter = appStorage
): Promise<GuestMigrationState> {
  try {
    const state = await storage.getItem<GuestMigrationState>(MIGRATION_STATE_KEY);
    if (state && typeof state === "object" && state.status) {
      return state;
    }
  } catch {
    // Ignore error and return fresh idle state
  }

  return {
    status: "idle",
    authenticatedUserId: null,
    startedAt: null,
    completedAt: null,
  };
}

export async function setGuestMigrationState(
  state: GuestMigrationState,
  storage: StorageAdapter = appStorage
): Promise<void> {
  await storage.setItem(MIGRATION_STATE_KEY, state);
}

/**
 * Collects all guest domain entities stored in IndexedDB/StorageAdapter.
 */
export async function extractGuestData(
  storage: StorageAdapter = appStorage
): Promise<GuestMigrationPayload> {
  const guest = await getOrCreateGuestIdentity(storage);

  const [
    workspaces,
    topicProgress,
    plannerTasks,
    studySessions,
    revisionItems,
    practiceSessions,
    savedResources,
    mockTests,
    mockTestResults,
    preferences,
    notificationPreferences,
  ] = await Promise.all([
    storage.getItem<unknown[]>(GUEST_STORAGE_KEYS.WORKSPACES),
    storage.getItem<unknown[]>(GUEST_STORAGE_KEYS.TOPIC_PROGRESS),
    storage.getItem<unknown[]>(GUEST_STORAGE_KEYS.PLANNER_TASKS),
    storage.getItem<unknown[]>(GUEST_STORAGE_KEYS.STUDY_SESSIONS),
    storage.getItem<unknown[]>(GUEST_STORAGE_KEYS.REVISION_ITEMS),
    storage.getItem<unknown[]>(GUEST_STORAGE_KEYS.PRACTICE_SESSIONS),
    storage.getItem<unknown[]>(GUEST_STORAGE_KEYS.SAVED_RESOURCES),
    storage.getItem<unknown[]>(GUEST_STORAGE_KEYS.MOCK_TESTS),
    storage.getItem<unknown[]>(GUEST_STORAGE_KEYS.MOCK_TEST_RESULTS),
    storage.getItem<unknown>(GUEST_STORAGE_KEYS.USER_PREFERENCES),
    storage.getItem<unknown>(GUEST_STORAGE_KEYS.NOTIFICATION_PREFERENCES),
  ]);

  return {
    guestId: guest.id,
    workspaces: (workspaces as GuestMigrationPayload["workspaces"]) || [],
    topicProgress: (topicProgress as GuestMigrationPayload["topicProgress"]) || [],
    plannerTasks: (plannerTasks as GuestMigrationPayload["plannerTasks"]) || [],
    studySessions: (studySessions as GuestMigrationPayload["studySessions"]) || [],
    revisionItems: (revisionItems as GuestMigrationPayload["revisionItems"]) || [],
    practiceSessions: (practiceSessions as GuestMigrationPayload["practiceSessions"]) || [],
    savedResources: (savedResources as GuestMigrationPayload["savedResources"]) || [],
    mockTests: (mockTests as GuestMigrationPayload["mockTests"]) || [],
    mockTestResults: (mockTestResults as GuestMigrationPayload["mockTestResults"]) || [],
    preferences: (preferences as GuestMigrationPayload["preferences"]) || undefined,
    notificationPreferences: (notificationPreferences as GuestMigrationPayload["notificationPreferences"]) || undefined,
  };
}

/**
 * Safely removes guest domain preparation records from local storage.
 * Only called AFTER server confirms successful migration.
 */
export async function clearGuestDomainData(
  storage: StorageAdapter = appStorage
): Promise<void> {
  await Promise.all([
    storage.removeItem(GUEST_STORAGE_KEYS.WORKSPACES),
    storage.removeItem(GUEST_STORAGE_KEYS.TOPIC_PROGRESS),
    storage.removeItem(GUEST_STORAGE_KEYS.PLANNER_TASKS),
    storage.removeItem(GUEST_STORAGE_KEYS.STUDY_SESSIONS),
    storage.removeItem(GUEST_STORAGE_KEYS.REVISION_ITEMS),
    storage.removeItem(GUEST_STORAGE_KEYS.PRACTICE_SESSIONS),
    storage.removeItem(GUEST_STORAGE_KEYS.SAVED_RESOURCES),
    storage.removeItem(GUEST_STORAGE_KEYS.MOCK_TESTS),
    storage.removeItem(GUEST_STORAGE_KEYS.MOCK_TEST_RESULTS),
    storage.removeItem(GUEST_STORAGE_KEYS.USER_PREFERENCES),
    storage.removeItem(GUEST_STORAGE_KEYS.NOTIFICATION_PREFERENCES),
  ]);
}

/**
 * Executes the complete guest-to-account migration lifecycle:
 * 1. Verifies idempotency state (skips if already completed for this user).
 * 2. Extracts local guest records.
 * 3. Sends payload to `/api/auth/migrate` authenticated endpoint.
 * 4. On confirmation, marks state as completed and cleans up local guest data.
 * 5. On failure, retains local guest data and flags state for safe retry.
 */
export async function migrateGuestData(
  authenticatedUserId: string,
  storage: StorageAdapter = appStorage
): Promise<{ success: boolean; summary?: MigrationSummary; error?: string }> {
  const currentState = await getGuestMigrationState(storage);

  // Idempotency: if already migrated for this user, do not run again
  if (
    currentState.status === "completed" &&
    currentState.authenticatedUserId === authenticatedUserId
  ) {
    return { success: true };
  }

  // Update state to in_progress
  await setGuestMigrationState(
    {
      status: "in_progress",
      authenticatedUserId,
      startedAt: Date.now(),
      completedAt: null,
    },
    storage
  );

  try {
    const payload = await extractGuestData(storage);

    // If the guest has no local records at all, consider it complete. Check
    // every collection: short-circuiting on a subset would silently strand
    // data living only in the others (e.g. revision items or mock results)
    // and mark the migration permanently done for this user.
    const hasData =
      (payload.workspaces?.length ?? 0) > 0 ||
      (payload.topicProgress?.length ?? 0) > 0 ||
      (payload.plannerTasks?.length ?? 0) > 0 ||
      (payload.studySessions?.length ?? 0) > 0 ||
      (payload.revisionItems?.length ?? 0) > 0 ||
      (payload.practiceSessions?.length ?? 0) > 0 ||
      (payload.savedResources?.length ?? 0) > 0 ||
      (payload.mockTests?.length ?? 0) > 0 ||
      (payload.mockTestResults?.length ?? 0) > 0 ||
      payload.preferences !== undefined ||
      payload.notificationPreferences !== undefined;

    if (!hasData) {
      await setGuestMigrationState(
        {
          status: "completed",
          authenticatedUserId,
          startedAt: currentState.startedAt || Date.now(),
          completedAt: Date.now(),
        },
        storage
      );
      return { success: true };
    }

    // Dispatch to authenticated migration API
    const res = await fetch("/api/auth/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errData.error || `Migration failed with status ${res.status}`);
    }

    const data = (await res.json()) as { summary: MigrationSummary };
    const summary: MigrationSummary = data.summary;

    // Successful: mark completed and clean up local data
    await setGuestMigrationState(
      {
        status: "completed",
        authenticatedUserId,
        startedAt: currentState.startedAt || Date.now(),
        completedAt: Date.now(),
      },
      storage
    );

    await clearGuestDomainData(storage);

    return { success: true, summary };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await setGuestMigrationState(
      {
        status: "failed",
        authenticatedUserId,
        startedAt: currentState.startedAt || Date.now(),
        completedAt: null,
        error: errorMessage,
      },
      storage
    );
    return { success: false, error: errorMessage };
  }
}

import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage";
import {
  GuestWorkspaceRepository,
  GuestPreferencesRepository,
  GUEST_STORAGE_KEYS,
} from "@/repositories/guest-repositories";
import { ensureWorkspaceForUser } from "@/lib/workspaces/ensure-workspace";
import { createTestDb } from "./db-test-adapter";
import { users, exams, examAttempts } from "@/db/schema";
import type { DatabaseInstance } from "@/db";

const ATTEMPT_ID = "attempt_neet_2027";

describe("Phase 5 Guest Workspace Creation & Duplicate Prevention", () => {
  let storage: MemoryStorageAdapter;
  let repo: GuestWorkspaceRepository;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    repo = new GuestWorkspaceRepository(storage, "guest_test");
  });

  it("creates a workspace and resolves it as active", async () => {
    const ws = await repo.ensureWorkspaceForAttempt(ATTEMPT_ID);
    expect(ws.examAttemptId).toBe(ATTEMPT_ID);
    expect(ws.isActive).toBe(true);

    const active = await repo.getActiveWorkspace();
    expect(active?.id).toBe(ws.id);
  });

  it("reuses the existing workspace on repeat onboarding (no duplicates)", async () => {
    const first = await repo.ensureWorkspaceForAttempt(ATTEMPT_ID);
    const second = await repo.ensureWorkspaceForAttempt(ATTEMPT_ID);
    const third = await repo.ensureWorkspaceForAttempt(ATTEMPT_ID);

    expect(second.id).toBe(first.id);
    expect(third.id).toBe(first.id);

    const all = await repo.getWorkspaces();
    expect(all.length).toBe(1);
  });

  it("keeps exactly one active workspace after re-ensuring with prior inactive state", async () => {
    const first = await repo.ensureWorkspaceForAttempt(ATTEMPT_ID);
    await repo.setActiveWorkspace(first.id); // no-op path
    const again = await repo.ensureWorkspaceForAttempt(ATTEMPT_ID);
    expect(again.id).toBe(first.id);

    const list = await repo.getWorkspaces();
    expect(list.filter((w) => w.isActive).length).toBe(1);
  });

  it("resolves no active workspace before onboarding (new guest enters setup)", async () => {
    const active = await repo.getActiveWorkspace();
    expect(active).toBeNull();
    const byAttempt = await repo.getWorkspaceForAttempt(ATTEMPT_ID);
    expect(byAttempt).toBeNull();
  });

  it("persists guest preferences with daily goal and preparation stage", async () => {
    const prefs = new GuestPreferencesRepository(storage, "guest_test");
    await prefs.saveUserPreferences({
      dailyStudyGoalMinutes: 90,
      preparationStage: "practicing_regularly",
    });

    const stored = await prefs.getUserPreferences();
    expect(stored?.dailyStudyGoalMinutes).toBe(90);
    expect(stored?.preparationStage).toBe("practicing_regularly");
  });
});

describe("Phase 5 Authenticated Workspace Ensure (server-side)", () => {
  let db: DatabaseInstance;
  const userId = "usr_phase5";

  beforeEach(async () => {
    db = createTestDb();
    await db.insert(users).values({
      id: userId,
      email: "phase5@parikshaverse.in",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(exams).values({
      id: "exam_neet",
      name: "NEET",
      shortName: "NEET",
      slug: "neet",
      category: "medical",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(examAttempts).values({
      id: ATTEMPT_ID,
      examId: "exam_neet",
      slug: "neet-2027",
      label: "NEET 2027",
      status: "upcoming",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("rejects attempt IDs that do not exist in the database", async () => {
    const result = await ensureWorkspaceForUser(db, userId, "attempt_jee_2028");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("attempt_not_found");
  });

  it("creates a workspace once and reuses it deterministically", async () => {
    const first = await ensureWorkspaceForUser(db, userId, ATTEMPT_ID);
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.created).toBe(true);

    const second = await ensureWorkspaceForUser(db, userId, ATTEMPT_ID);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.created).toBe(false);
      expect(second.workspace.id).toBe(first.workspace.id);
      expect(second.workspace.isActive).toBe(true);
    }

    const third = await ensureWorkspaceForUser(db, userId, ATTEMPT_ID);
    expect(third.ok).toBe(true);
  });

  it("enforces ownership: another user's ensure does not touch the first user's workspace", async () => {
    const otherUserId = "usr_other";
    await db.insert(users).values({
      id: otherUserId,
      email: "other@parikshaverse.in",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const alice = await ensureWorkspaceForUser(db, userId, ATTEMPT_ID);
    const bob = await ensureWorkspaceForUser(db, otherUserId, ATTEMPT_ID);

    expect(alice.ok).toBe(true);
    expect(bob.ok).toBe(true);
    if (alice.ok && bob.ok) {
      expect(alice.workspace.id).not.toBe(bob.workspace.id);
      expect(alice.workspace.userId).toBe(userId);
      expect(bob.workspace.userId).toBe(otherUserId);
    }
  });
});

describe("Phase 5 Returning User Resolution", () => {
  it("skips onboarding when an active workspace exists (guest persistence)", async () => {
    const storage = new MemoryStorageAdapter();
    const repo = new GuestWorkspaceRepository(storage, "guest_returning");
    await repo.ensureWorkspaceForAttempt(ATTEMPT_ID);

    // Simulates a fresh page load: a new repository over the same storage
    const reloaded = new GuestWorkspaceRepository(storage, "guest_returning");
    const active = await reloaded.getActiveWorkspace();
    expect(active).not.toBeNull();
    expect(active?.examAttemptId).toBe(ATTEMPT_ID);
  });

  it("enters onboarding when no workspace exists yet", async () => {
    const storage = new MemoryStorageAdapter();
    const repo = new GuestWorkspaceRepository(storage, "guest_new");
    const active = await repo.getActiveWorkspace();
    expect(active).toBeNull();
    expect(await storage.getItem(GUEST_STORAGE_KEYS.WORKSPACES)).toBeNull();
  });
});

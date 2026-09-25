import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./db-test-adapter";
import type { DatabaseInstance } from "@/db";
import { seedExam } from "@/db/seeds/seed-exam";
import { neetSeedData } from "@/db/seeds/data/neet";
import { revisionItemRepository } from "@/repositories/revision.repository";
import { GuestRevisionRepository, GuestTopicProgressRepository, createGuestRepositories } from "@/repositories/guest-repositories";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage";
import { users, userWorkspaces } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { applyRevisionCompletion } from "@/domain/revision";

const WS = "ws_rev_test";
const TOPIC = "exam_neet_physics_physics-and-measurement_units-and-measurements";
const TOPIC_2 = "exam_neet_physics_kinematics_motion-in-straight-line";
const AT = new Date(2026, 8, 24, 15, 0, 0);

async function seedWorkspace(db: DatabaseInstance, workspaceId: string, userId: string) {
  const now = new Date();
  await db.insert(users).values({
    id: userId,
    email: `${userId}@example.com`,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(userWorkspaces).values({
    id: workspaceId,
    userId,
    examAttemptId: "attempt_neet_2027",
    isActive: true,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

describe("Revision Repository & API Security (D1)", () => {
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createTestDb();
    await seedExam(db, neetSeedData);
    await seedWorkspace(db, WS, "usr_rev_test");
  });

  it("starts empty for a workspace", async () => {
    const items = await revisionItemRepository.getRevisionItemsForWorkspace(db, WS);
    expect(items).toEqual([]);
  });

  it("inserts then updates without creating duplicate rows per topic", async () => {
    const first = await revisionItemRepository.upsertRevisionItem(db, {
      workspaceId: WS,
      topicId: TOPIC,
      revisionNumber: 2,
      lastRevisedAt: AT,
      nextRevisionAt: new Date(2026, 8, 27),
      status: "scheduled",
    });
    expect(first.revisionNumber).toBe(2);
    expect(first.createdAt).toBeInstanceOf(Date);

    const second = await revisionItemRepository.upsertRevisionItem(db, {
      workspaceId: WS,
      topicId: TOPIC,
      revisionNumber: 3,
      lastRevisedAt: new Date(2026, 8, 27, 10, 0, 0),
      nextRevisionAt: new Date(2026, 9, 4),
      status: "scheduled",
    });

    const all = await revisionItemRepository.getRevisionItemsForWorkspace(db, WS);
    expect(all).toHaveLength(1); // updated in place, never duplicated
    expect(all[0].id).toBe(first.id);
    expect(all[0].revisionNumber).toBe(3);
    expect(second.revisionNumber).toBe(3);
  });

  it("resolves the single item per topic", async () => {
    await revisionItemRepository.upsertRevisionItem(db, {
      workspaceId: WS,
      topicId: TOPIC,
      revisionNumber: 1,
      nextRevisionAt: new Date(2026, 8, 25),
      status: "scheduled",
    });
    const found = await revisionItemRepository.getRevisionItemForTopic(db, WS, TOPIC);
    const missing = await revisionItemRepository.getRevisionItemForTopic(db, WS, TOPIC_2);
    expect(found?.topicId).toBe(TOPIC);
    expect(missing).toBeNull();
  });

  it("keeps revision items scoped to their workspace", async () => {
    await seedWorkspace(db, "ws_other", "usr_other");
    await revisionItemRepository.upsertRevisionItem(db, {
      workspaceId: WS,
      topicId: TOPIC,
      revisionNumber: 1,
      nextRevisionAt: new Date(2026, 8, 25),
      status: "scheduled",
    });
    await revisionItemRepository.upsertRevisionItem(db, {
      workspaceId: "ws_other",
      topicId: TOPIC,
      revisionNumber: 1,
      nextRevisionAt: new Date(2026, 8, 25),
      status: "scheduled",
    });

    const mine = await revisionItemRepository.getRevisionItemsForWorkspace(db, WS);
    const theirs = await revisionItemRepository.getRevisionItemsForWorkspace(db, "ws_other");
    expect(mine).toHaveLength(1);
    expect(mine[0].workspaceId).toBe(WS);
    expect(theirs).toHaveLength(1);
    expect(theirs[0].workspaceId).toBe("ws_other");
  });

  it("enforces ownership at the query layer: foreign workspaces see nothing", async () => {
    await revisionItemRepository.upsertRevisionItem(db, {
      workspaceId: WS,
      topicId: TOPIC,
      revisionNumber: 1,
      nextRevisionAt: new Date(2026, 8, 25),
      status: "scheduled",
    });

    // The API route's resolveOwnedWorkspace equivalent: the workspace must
    // belong to the requesting user before its items are ever read.
    const ownedRows = await db
      .select({ id: userWorkspaces.id })
      .from(userWorkspaces)
      .where(and(eq(userWorkspaces.id, "ws_does_not_exist"), eq(userWorkspaces.userId, "usr_rev_test")))
      .limit(1);
    expect(ownedRows).toHaveLength(0);

    const foreignRows = await db
      .select({ id: userWorkspaces.id })
      .from(userWorkspaces)
      .where(and(eq(userWorkspaces.id, WS), eq(userWorkspaces.userId, "usr_other")))
      .limit(1);
    expect(foreignRows).toHaveLength(0);

    const ownRows = await db
      .select({ id: userWorkspaces.id })
      .from(userWorkspaces)
      .where(and(eq(userWorkspaces.id, WS), eq(userWorkspaces.userId, "usr_rev_test")))
      .limit(1);
    expect(ownRows).toHaveLength(1);
  });

  it("persists a full applyRevisionCompletion payload round-trip", async () => {
    const completion = applyRevisionCompletion(
      { workspaceId: WS, topicId: TOPIC, existingProgress: null, existingRevisionItem: null },
      AT
    );
    const saved = await revisionItemRepository.upsertRevisionItem(db, completion.revisionItem);
    expect(saved.revisionNumber).toBe(2);
    expect(saved.nextRevisionAt?.getTime()).toBe(completion.nextRevisionAt.getTime());
    expect(saved.lastRevisedAt?.getTime()).toBe(AT.getTime());
  });
});

describe("Guest Revision Repository (IndexedDB-backed storage)", () => {
  it("persists revision completions without duplicate records", async () => {
    const storage = new MemoryStorageAdapter();
    const repo = new GuestRevisionRepository(storage);
    const progressRepo = new GuestTopicProgressRepository(storage);

    // First completion on a fresh topic.
    const first = applyRevisionCompletion(
      { workspaceId: WS, topicId: TOPIC, existingProgress: null, existingRevisionItem: null },
      AT
    );
    await repo.upsertRevisionItem(first.revisionItem);
    await progressRepo.upsertProgress(first.progress);

    const itemsAfterFirst = await repo.getRevisionItems(WS);
    expect(itemsAfterFirst).toHaveLength(1);
    expect(itemsAfterFirst[0].revisionNumber).toBe(2);
    expect(itemsAfterFirst[0].nextRevisionAt).toBeInstanceOf(Date);

    // Second completion upserts the same row.
    const second = applyRevisionCompletion(
      {
        workspaceId: WS,
        topicId: TOPIC,
        existingProgress: await progressRepo.getProgress(WS, TOPIC),
        existingRevisionItem: itemsAfterFirst[0],
      },
      AT
    );
    await repo.upsertRevisionItem(second.revisionItem);

    const itemsAfterSecond = await repo.getRevisionItems(WS);
    expect(itemsAfterSecond).toHaveLength(1);
    expect(itemsAfterSecond[0].revisionNumber).toBe(3);
    expect(itemsAfterSecond[0].id).toBe(itemsAfterFirst[0].id);
  });

  it("serves the revision repository through the guest repository set", async () => {
    const repos = createGuestRepositories(new MemoryStorageAdapter(), "guest_test");
    await repos.revision.upsertRevisionItem({
      workspaceId: WS,
      topicId: TOPIC,
      revisionNumber: 1,
      nextRevisionAt: new Date(2026, 8, 25),
      status: "scheduled",
    });
    const items = await repos.revision.getRevisionItems(WS);
    expect(items).toHaveLength(1);
    expect(items[0].topicId).toBe(TOPIC);
  });
});

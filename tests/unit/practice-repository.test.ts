import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./db-test-adapter";
import type { DatabaseInstance } from "@/db";
import { seedExam } from "@/db/seeds/seed-exam";
import { neetSeedData } from "@/db/seeds/data/neet";
import { practiceRepository } from "@/repositories/practice.repository";
import { topicProgressRepository } from "@/repositories/progress.repository";
import {
  GuestPracticeRepository,
  createGuestRepositories,
} from "@/repositories/guest-repositories";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage";
import { users, userWorkspaces } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  recordPracticeSession,
  validatePracticeInput,
  applyPracticeSessionToProgress,
  calculateAccuracyBps,
} from "@/domain/practice";
import { getTopicMetadata } from "@/domain/dashboard";

const WS = "ws_prac_test";
const WS_FOREIGN = "ws_foreign_test";
const USER_ID = "usr_prac_test";
const USER_OTHER = "usr_other";
const TOPIC = "exam_neet_physics_physics-and-measurement_units-and-measurements";
const TOPIC_INVALID = "exam_invalid_topic_xyz";

async function seedUserAndWorkspace(
  db: DatabaseInstance,
  workspaceId: string,
  userId: string,
  examAttemptId = "attempt_neet_2027"
) {
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
    examAttemptId,
    isActive: true,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

describe("Practice Repository & D1 Persistence (Phase 9)", () => {
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createTestDb();
    await seedExam(db, neetSeedData);
    await seedUserAndWorkspace(db, WS, USER_ID);
    await seedUserAndWorkspace(db, WS_FOREIGN, USER_OTHER);
  });

  it("starts with empty practice sessions for a workspace", async () => {
    const sessions = await practiceRepository.getSessionsForWorkspaceId(db, WS);
    expect(sessions).toEqual([]);
  });

  it("persists a valid practice session to D1 and reads it back", async () => {
    const created = await practiceRepository.createPracticeSession(db, {
      workspaceId: WS,
      topicId: TOPIC,
      questionCount: 25,
      correct: 20,
      incorrect: 5,
      unattempted: 0,
      durationMinutes: 30,
      completedAt: new Date("2026-09-25T10:00:00Z"),
    });

    expect(created.id).toBeDefined();
    expect(created.questionCount).toBe(25);
    expect(created.correct).toBe(20);
    expect(created.durationMinutes).toBe(30);

    const all = await practiceRepository.getSessionsForWorkspaceId(db, WS);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);
    expect(all[0].questionCount).toBe(25);
  });

  it("creates separate legitimate sessions for duplicate practice submissions", async () => {
    const first = await practiceRepository.createPracticeSession(db, {
      workspaceId: WS,
      topicId: TOPIC,
      questionCount: 10,
      correct: 8,
      incorrect: 2,
      unattempted: 0,
      durationMinutes: 15,
      completedAt: new Date("2026-09-25T10:00:00Z"),
    });

    const second = await practiceRepository.createPracticeSession(db, {
      workspaceId: WS,
      topicId: TOPIC,
      questionCount: 10,
      correct: 9,
      incorrect: 1,
      unattempted: 0,
      durationMinutes: 15,
      completedAt: new Date("2026-09-25T11:00:00Z"),
    });

    expect(first.id).not.toBe(second.id);

    const all = await practiceRepository.getSessionsForWorkspaceId(db, WS);
    expect(all).toHaveLength(2);
  });

  it("isolates practice sessions between different workspaces", async () => {
    await practiceRepository.createPracticeSession(db, {
      workspaceId: WS,
      topicId: TOPIC,
      questionCount: 10,
      correct: 8,
      incorrect: 2,
      completedAt: new Date(),
    });

    await practiceRepository.createPracticeSession(db, {
      workspaceId: WS_FOREIGN,
      topicId: TOPIC,
      questionCount: 20,
      correct: 18,
      incorrect: 2,
      completedAt: new Date(),
    });

    const mySessions = await practiceRepository.getSessionsForWorkspaceId(db, WS);
    const foreignSessions = await practiceRepository.getSessionsForWorkspaceId(db, WS_FOREIGN);

    expect(mySessions).toHaveLength(1);
    expect(mySessions[0].questionCount).toBe(10);

    expect(foreignSessions).toHaveLength(1);
    expect(foreignSessions[0].questionCount).toBe(20);
  });

  it("filters sessions by topicId correctly", async () => {
    const TOPIC_2 = "exam_neet_physics_kinematics_motion-in-straight-line";
    await practiceRepository.createPracticeSession(db, {
      workspaceId: WS,
      topicId: TOPIC,
      questionCount: 10,
      correct: 7,
      completedAt: new Date(),
    });
    await practiceRepository.createPracticeSession(db, {
      workspaceId: WS,
      topicId: TOPIC_2,
      questionCount: 15,
      correct: 12,
      completedAt: new Date(),
    });

    const topic1Sessions = await practiceRepository.getSessionsForTopicId(db, WS, TOPIC);
    expect(topic1Sessions).toHaveLength(1);
    expect(topic1Sessions[0].questionCount).toBe(10);
  });

  it("calculates accuracy server-side and updates topic-level progress in D1", async () => {
    const attempted = 20;
    const correct = 16;
    const incorrect = attempted - correct; // Server calculated: 4
    const completedAt = new Date("2026-09-25T14:00:00Z");

    const session = await practiceRepository.createPracticeSession(db, {
      workspaceId: WS,
      topicId: TOPIC,
      questionCount: attempted,
      correct,
      incorrect,
      unattempted: 0,
      durationMinutes: 30,
      completedAt,
    });

    const allTopicSessions = await practiceRepository.getSessionsForTopicId(db, WS, TOPIC);
    const existingProgress = await topicProgressRepository.getTopicProgress(db, WS, TOPIC);

    const patch = applyPracticeSessionToProgress({
      workspaceId: WS,
      topicId: TOPIC,
      existingProgress,
      sessions: allTopicSessions,
      completedAt,
    });

    const updatedProgress = await topicProgressRepository.upsertTopicProgress(db, patch);

    expect(session.incorrect).toBe(4);
    expect(updatedProgress.practiceAttempts).toBe(20);
    expect(updatedProgress.correctAnswers).toBe(16);
    expect(updatedProgress.incorrectAnswers).toBe(4);
    expect(updatedProgress.accuracy).toBe(8000); // 80%
    expect(updatedProgress.status).toBe("practiced");
  });
});

describe("API Security & Authorization Rules", () => {
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createTestDb();
    await seedExam(db, neetSeedData);
    await seedUserAndWorkspace(db, WS, USER_ID);
    await seedUserAndWorkspace(db, WS_FOREIGN, USER_OTHER);
  });

  it("validates that a foreign workspace is rejected during ownership check", async () => {
    // User attempts to access a workspace they do not own
    const ownedRows = await db
      .select({ id: userWorkspaces.id })
      .from(userWorkspaces)
      .where(and(eq(userWorkspaces.id, WS_FOREIGN), eq(userWorkspaces.userId, USER_ID)))
      .limit(1);

    expect(ownedRows).toHaveLength(0); // Foreign workspace ownership check fails -> 404
  });

  it("validates that an owned workspace succeeds ownership check", async () => {
    const ownedRows = await db
      .select({ id: userWorkspaces.id, examAttemptId: userWorkspaces.examAttemptId })
      .from(userWorkspaces)
      .where(and(eq(userWorkspaces.id, WS), eq(userWorkspaces.userId, USER_ID)))
      .limit(1);

    expect(ownedRows).toHaveLength(1);
    expect(ownedRows[0].examAttemptId).toBe("attempt_neet_2027");
  });

  it("rejects non-existent topic not belonging to the workspace exam taxonomy", async () => {
    const meta = getTopicMetadata(TOPIC_INVALID, "attempt_neet_2027");
    expect(meta).toBeNull(); // Mismatch -> 400

    const validMeta = getTopicMetadata(TOPIC, "attempt_neet_2027");
    expect(validMeta).not.toBeNull();
    expect(validMeta?.topicName).toBe("Units of Measurement, SI Units & Derived Units");
  });

  it("rejects invalid input payloads via domain validation schema", () => {
    // Zero questions attempted
    const res1 = validatePracticeInput({
      workspaceId: WS,
      topicId: TOPIC,
      questionsAttempted: 0,
      correctAnswers: 0,
    });
    expect(res1.success).toBe(false);

    // Correct exceeding attempted
    const res2 = validatePracticeInput({
      workspaceId: WS,
      topicId: TOPIC,
      questionsAttempted: 10,
      correctAnswers: 15,
    });
    expect(res2.success).toBe(false);

    // Negative duration
    const res3 = validatePracticeInput({
      workspaceId: WS,
      topicId: TOPIC,
      questionsAttempted: 10,
      correctAnswers: 8,
      durationMinutes: -5,
    });
    expect(res3.success).toBe(false);

    // Valid payload
    const res4 = validatePracticeInput({
      workspaceId: WS,
      topicId: TOPIC,
      questionsAttempted: 20,
      correctAnswers: 16,
      durationMinutes: 30,
    });
    expect(res4.success).toBe(true);
  });
});

describe("Guest Practice Repository (IndexedDB storage)", () => {
  it("persists sessions and revives Dates accurately", async () => {
    const storage = new MemoryStorageAdapter();
    const repo = new GuestPracticeRepository(storage);

    const created = await repo.createPracticeSession({
      workspaceId: WS,
      topicId: TOPIC,
      questionCount: 20,
      correct: 15,
      incorrect: 5,
      durationMinutes: 25,
      completedAt: new Date("2026-09-25T08:30:00Z"),
    });

    expect(created.id).toBeDefined();

    const all = await repo.getPracticeSessions(WS);
    expect(all).toHaveLength(1);
    expect(all[0].completedAt).toBeInstanceOf(Date);
    expect(all[0].completedAt.getTime()).toBe(new Date("2026-09-25T08:30:00Z").getTime());
  });

  it("serves the practice repository through createGuestRepositories and recordPracticeSession", async () => {
    const repos = createGuestRepositories(new MemoryStorageAdapter(), "guest_test");

    const result = await recordPracticeSession(repos, {
      workspaceId: WS,
      topicId: TOPIC,
      questionsAttempted: 30,
      correctAnswers: 24,
      durationMinutes: 40,
      sessionType: "focused",
    });

    expect(result.session.questionCount).toBe(30);
    expect(result.accuracyBps).toBe(8000);
    expect(result.accuracyPct).toBe(80);

    const sessions = await repos.practice.getPracticeSessions(WS);
    expect(sessions).toHaveLength(1);

    const progress = await repos.progress.getProgress(WS, TOPIC);
    expect(progress).toBeDefined();
    expect(progress?.practiceAttempts).toBe(30);
    expect(progress?.correctAnswers).toBe(24);
    expect(progress?.accuracy).toBe(8000);
    expect(progress?.status).toBe("practiced");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./db-test-adapter";
import type { DatabaseInstance } from "@/db";
import {
  users,
  exams,
  examAttempts,
  subjects,
  chapters,
  topics,
  userWorkspaces,
  userTopicProgress,
  plannerTasks,
  studySessions,
  savedResources,
  resources,
  mockTests,
  mockTestResults,
  revisionItems,
} from "@/db/schema";
import { executeServerMigration } from "@/lib/auth/guest-migration-server";
import type { GuestMigrationPayload } from "@/lib/auth/auth-types";
import { eq } from "drizzle-orm";

describe("Guest → Account Migration & Conflict Resolution", () => {
  let db: DatabaseInstance;
  const userId = "usr_migrating_student";

  beforeEach(async () => {
    db = createTestDb();

    // Setup base user
    await db.insert(users).values({
      id: userId,
      email: "migrating@student.in",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Setup canonical exam hierarchy
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
      id: "attempt_neet_2027",
      examId: "exam_neet",
      slug: "neet-2027",
      label: "NEET 2027",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(subjects).values({
      id: "subj_bio",
      examId: "exam_neet",
      name: "Biology",
      slug: "biology",
      displayOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(chapters).values({
      id: "chap_genetics",
      subjectId: "subj_bio",
      name: "Genetics",
      slug: "genetics",
      displayOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(topics).values({
      id: "top_mendel",
      chapterId: "chap_genetics",
      name: "Mendelian Inheritance",
      slug: "mendelian-inheritance",
      displayOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(resources).values({
      id: "res_ncert_genetics",
      examId: "exam_neet",
      title: "NCERT Biology Ch 5",
      type: "ncert",
      url: "https://ncert.nic.in/biology-ch5.pdf",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("handles empty guest payload safely without errors", async () => {
    const emptyPayload: GuestMigrationPayload = {
      guestId: "guest_empty",
      workspaces: [],
      topicProgress: [],
    };

    const summary = await executeServerMigration(db, userId, emptyPayload);
    expect(summary.workspacesMigrated).toBe(0);
    expect(summary.topicProgressMigrated).toBe(0);
  });

  it("migrates new workspace and topic progress into fresh account", async () => {
    const payload: GuestMigrationPayload = {
      guestId: "guest_123",
      workspaces: [
        {
          id: "guest_ws_1",
          examAttemptId: "attempt_neet_2027",
          isActive: true,
          startedAt: new Date("2026-01-01"),
        },
      ],
      topicProgress: [
        {
          workspaceId: "guest_ws_1",
          topicId: "top_mendel",
          status: "learned",
          practiceAttempts: 5,
          correctAnswers: 4,
          incorrectAnswers: 1,
          accuracy: 8000,
          notes: "Focus on dihybrid cross",
        },
      ],
    };

    const summary = await executeServerMigration(db, userId, payload);
    expect(summary.workspacesMigrated).toBe(1);
    expect(summary.topicProgressMigrated).toBe(1);

    const workspaces = await db
      .select()
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, userId));

    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].examAttemptId).toBe("attempt_neet_2027");

    const progress = await db
      .select()
      .from(userTopicProgress)
      .where(eq(userTopicProgress.workspaceId, workspaces[0].id));

    expect(progress).toHaveLength(1);
    expect(progress[0].topicId).toBe("top_mendel");
    expect(progress[0].status).toBe("learned");
    expect(progress[0].accuracy).toBe(8000);
  });

  it("merges deterministically when user already has an active workspace for the same exam attempt", async () => {
    // Pre-create an authenticated workspace
    const existingWsId = "ws_existing_auth";
    await db.insert(userWorkspaces).values({
      id: existingWsId,
      userId,
      examAttemptId: "attempt_neet_2027",
      isActive: true,
      startedAt: new Date("2025-12-01"),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Existing authenticated topic progress: status 'practiced', 10 attempts, 7 correct, 3 incorrect
    await db.insert(userTopicProgress).values({
      id: "prog_auth_1",
      workspaceId: existingWsId,
      topicId: "top_mendel",
      status: "practiced",
      practiceAttempts: 10,
      correctAnswers: 7,
      incorrectAnswers: 3,
      accuracy: 7000,
      lastStudiedAt: new Date("2026-01-10"),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Guest progress to merge: status 'revised', 10 attempts, 9 correct, 1 incorrect
    const payload: GuestMigrationPayload = {
      guestId: "guest_merge_test",
      workspaces: [
        {
          id: "guest_ws_conflicting",
          examAttemptId: "attempt_neet_2027",
          isActive: true,
          startedAt: new Date("2026-01-01"),
        },
      ],
      topicProgress: [
        {
          workspaceId: "guest_ws_conflicting",
          topicId: "top_mendel",
          status: "revised", // More advanced status than 'practiced'
          practiceAttempts: 10,
          correctAnswers: 9,
          incorrectAnswers: 1,
          accuracy: 9000,
          lastStudiedAt: new Date("2026-01-20"), // Newer date
          notes: "Guest revision notes",
        },
      ],
    };

    const summary = await executeServerMigration(db, userId, payload);
    // Did not create duplicate workspace! Reused existing
    expect(summary.workspacesMigrated).toBe(0);

    const workspaces = await db
      .select()
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, userId));
    expect(workspaces).toHaveLength(1);

    const mergedProgress = await db
      .select()
      .from(userTopicProgress)
      .where(eq(userTopicProgress.workspaceId, existingWsId));

    expect(mergedProgress).toHaveLength(1);
    const p = mergedProgress[0];
    // Status promoted to 'revised'
    expect(p.status).toBe("revised");
    // Attempts summed: 10 + 10 = 20
    expect(p.practiceAttempts).toBe(20);
    // Correct summed: 7 + 9 = 16
    expect(p.correctAnswers).toBe(16);
    // Incorrect summed: 3 + 1 = 4
    expect(p.incorrectAnswers).toBe(4);
    // Accuracy recalculated: 16 / 20 = 80.00% = 8000 bps
    expect(p.accuracy).toBe(8000);
    // Last studied updated to newer date (2026-01-20)
    expect(p.lastStudiedAt?.getTime()).toBe(new Date("2026-01-20").getTime());
    // Notes preserved / merged
    expect(p.notes).toContain("Guest revision notes");
  });

  it("is fully idempotent: executing migration twice produces zero duplicates", async () => {
    const payload: GuestMigrationPayload = {
      guestId: "guest_idempotent",
      workspaces: [
        {
          id: "guest_ws_idem",
          examAttemptId: "attempt_neet_2027",
          isActive: true,
          startedAt: new Date("2026-01-01"),
        },
      ],
      topicProgress: [
        {
          workspaceId: "guest_ws_idem",
          topicId: "top_mendel",
          status: "learned",
          practiceAttempts: 5,
          correctAnswers: 5,
          incorrectAnswers: 0,
          accuracy: 10000,
        },
      ],
      plannerTasks: [
        {
          workspaceId: "guest_ws_idem",
          title: "Complete NCERT Ch 5 questions",
          type: "practice",
          scheduledDate: "2026-02-01",
          durationMinutes: 45,
          status: "upcoming",
        },
      ],
      studySessions: [
        {
          id: "sess_historical_1",
          workspaceId: "guest_ws_idem",
          durationMinutes: 60,
          sessionType: "focused",
          startedAt: new Date("2026-01-15T10:00:00Z"),
          endedAt: new Date("2026-01-15T11:00:00Z"),
        },
      ],
      savedResources: [
        {
          workspaceId: "guest_ws_idem",
          resourceId: "res_ncert_genetics",
          savedAt: new Date(),
        },
      ],
      mockTests: [
        {
          id: "mock_test_1",
          workspaceId: "guest_ws_idem",
          title: "NEET Part Test 1",
          type: "chapter",
          durationMinutes: 60,
        },
      ],
      mockTestResults: [
        {
          id: "res_mock_1",
          mockTestId: "mock_test_1",
          score: 180,
          totalMarks: 180,
          correct: 45,
          incorrect: 0,
          unattempted: 0,
          accuracy: 10000,
          completedAt: new Date(),
        },
      ],
    };

    // First execution
    const summary1 = await executeServerMigration(db, userId, payload);
    expect(summary1.workspacesMigrated).toBe(1);
    expect(summary1.topicProgressMigrated).toBe(1);
    expect(summary1.plannerTasksMigrated).toBe(1);
    expect(summary1.studySessionsMigrated).toBe(1);
    expect(summary1.savedResourcesMigrated).toBe(1);
    expect(summary1.mockTestsMigrated).toBe(1);
    expect(summary1.mockTestResultsMigrated).toBe(1);

    // Second execution (retry / identical call)
    const summary2 = await executeServerMigration(db, userId, payload);
    // Workspaces reused, tasks deduplicated, sessions deduplicated
    expect(summary2.workspacesMigrated).toBe(0);
    expect(summary2.plannerTasksMigrated).toBe(0);
    expect(summary2.studySessionsMigrated).toBe(0);
    expect(summary2.savedResourcesMigrated).toBe(0);
    expect(summary2.mockTestsMigrated).toBe(0);
    expect(summary2.mockTestResultsMigrated).toBe(0);

    // Verify row counts in database
    const allWorkspaces = await db.select().from(userWorkspaces).where(eq(userWorkspaces.userId, userId));
    expect(allWorkspaces).toHaveLength(1);

    const wsId = allWorkspaces[0].id;
    const allTasks = await db.select().from(plannerTasks).where(eq(plannerTasks.workspaceId, wsId));
    expect(allTasks).toHaveLength(1);

    const allSessions = await db.select().from(studySessions).where(eq(studySessions.workspaceId, wsId));
    expect(allSessions).toHaveLength(1);

    const allSaved = await db.select().from(savedResources).where(eq(savedResources.workspaceId, wsId));
    expect(allSaved).toHaveLength(1);

    const allMocks = await db.select().from(mockTests).where(eq(mockTests.workspaceId, wsId));
    expect(allMocks).toHaveLength(1);

    const allResults = await db.select().from(mockTestResults).where(eq(mockTestResults.mockTestId, allMocks[0].id));
    expect(allResults).toHaveLength(1);
  });

  it("preserves the guest revision schedule (nextRevisionAt) on fresh rows", async () => {
    const scheduledFor = new Date("2026-10-05T00:00:00Z");
    const payload: GuestMigrationPayload = {
      guestId: "guest_revision_schedule",
      workspaces: [
        {
          id: "guest_ws_rev",
          examAttemptId: "attempt_neet_2027",
          isActive: true,
          startedAt: new Date("2026-01-01"),
        },
      ],
      topicProgress: [
        {
          workspaceId: "guest_ws_rev",
          topicId: "top_mendel",
          status: "learned",
          nextRevisionAt: scheduledFor,
        },
      ],
      revisionItems: [
        {
          workspaceId: "guest_ws_rev",
          topicId: "top_mendel",
          revisionNumber: 1,
          nextRevisionAt: scheduledFor,
          status: "scheduled",
        },
      ],
    };

    const summary = await executeServerMigration(db, userId, payload);
    expect(summary.topicProgressMigrated).toBe(1);
    expect(summary.revisionItemsMigrated).toBe(1);

    const workspaces = await db
      .select()
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, userId));
    const wsId = workspaces[0].id;

    const progress = await db
      .select()
      .from(userTopicProgress)
      .where(eq(userTopicProgress.workspaceId, wsId));
    expect(progress).toHaveLength(1);
    expect(progress[0].nextRevisionAt?.getTime()).toBe(scheduledFor.getTime());

    const revisions = await db
      .select()
      .from(revisionItems)
      .where(eq(revisionItems.workspaceId, wsId));
    expect(revisions).toHaveLength(1);
    expect(revisions[0].status).toBe("scheduled");
    expect(revisions[0].nextRevisionAt?.getTime()).toBe(scheduledFor.getTime());
  });

  it("merge never clobbers the account's nextRevisionAt but fills it when missing", async () => {
    const existingWsId = "ws_existing_rev";
    const accountSchedule = new Date("2026-01-05T00:00:00Z");
    const guestSchedule = new Date("2026-01-20T00:00:00Z");

    // Account row already holds its own revision schedule
    await db.insert(userWorkspaces).values({
      id: existingWsId,
      userId,
      examAttemptId: "attempt_neet_2027",
      isActive: true,
      startedAt: new Date("2025-12-01"),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(userTopicProgress).values({
      id: "prog_auth_sched",
      workspaceId: existingWsId,
      topicId: "top_mendel",
      status: "practiced",
      practiceAttempts: 10,
      correctAnswers: 7,
      incorrectAnswers: 3,
      accuracy: 7000,
      nextRevisionAt: accountSchedule,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const summary = await executeServerMigration(db, userId, {
      guestId: "guest_merge_sched",
      workspaces: [
        {
          id: "guest_ws_sched",
          examAttemptId: "attempt_neet_2027",
          isActive: true,
        },
      ],
      topicProgress: [
        {
          workspaceId: "guest_ws_sched",
          topicId: "top_mendel",
          status: "learned",
          nextRevisionAt: guestSchedule,
        },
      ],
    });
    expect(summary.workspacesMigrated).toBe(0);

    const merged = await db
      .select()
      .from(userTopicProgress)
      .where(eq(userTopicProgress.id, "prog_auth_sched"));
    expect(merged).toHaveLength(1);
    // The account's existing schedule wins; the guest's does not overwrite it
    expect(merged[0].nextRevisionAt?.getTime()).toBe(accountSchedule.getTime());

    // A second topic whose account row has NO schedule yet must inherit the
    // guest's nextRevisionAt instead of losing it.
    await db.insert(topics).values({
      id: "top_respiration",
      chapterId: "chap_genetics",
      name: "Respiration in Plants",
      slug: "respiration-in-plants",
      displayOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(userTopicProgress).values({
      id: "prog_auth_unscheduled",
      workspaceId: existingWsId,
      topicId: "top_respiration",
      status: "learning",
      nextRevisionAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await executeServerMigration(db, userId, {
      guestId: "guest_merge_sched_2",
      workspaces: [
        {
          id: "guest_ws_sched_2",
          examAttemptId: "attempt_neet_2027",
          isActive: true,
        },
      ],
      topicProgress: [
        {
          workspaceId: "guest_ws_sched_2",
          topicId: "top_respiration",
          status: "learned",
          nextRevisionAt: guestSchedule,
        },
      ],
    });

    const filled = await db
      .select()
      .from(userTopicProgress)
      .where(eq(userTopicProgress.id, "prog_auth_unscheduled"));
    expect(filled).toHaveLength(1);
    expect(filled[0].nextRevisionAt?.getTime()).toBe(guestSchedule.getTime());
  });

  it("is idempotent for revision items: re-running never duplicates the schedule", async () => {
    const scheduledFor = new Date("2026-10-05T00:00:00Z");
    const payload: GuestMigrationPayload = {
      guestId: "guest_rev_idempotent",
      workspaces: [
        {
          id: "guest_ws_rev_idem",
          examAttemptId: "attempt_neet_2027",
          isActive: true,
        },
      ],
      revisionItems: [
        {
          workspaceId: "guest_ws_rev_idem",
          topicId: "top_mendel",
          revisionNumber: 1,
          nextRevisionAt: scheduledFor,
          status: "scheduled",
        },
      ],
    };

    const first = await executeServerMigration(db, userId, payload);
    expect(first.revisionItemsMigrated).toBe(1);

    const second = await executeServerMigration(db, userId, payload);
    expect(second.revisionItemsMigrated).toBe(0);

    const workspaces = await db
      .select()
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, userId));
    const wsId = workspaces[0].id;

    const revisions = await db
      .select()
      .from(revisionItems)
      .where(eq(revisionItems.workspaceId, wsId));
    expect(revisions).toHaveLength(1);
    expect(revisions[0].nextRevisionAt?.getTime()).toBe(scheduledFor.getTime());
  });
});

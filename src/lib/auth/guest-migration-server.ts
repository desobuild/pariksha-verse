import { eq, and } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import {
  userWorkspaces,
  userTopicProgress,
  plannerTasks,
  studySessions,
  revisionItems,
  practiceSessions,
  savedResources,
  mockTests,
  mockTestResults,
  userPreferences,
  notificationPreferences,
  type UserTopicProgress,
} from "@/db/schema";
import type { GuestMigrationPayload, MigrationSummary } from "./auth-types";

// Hierarchy of topic mastery
const STATUS_PRIORITY: Record<string, number> = {
  not_started: 0,
  learning: 1,
  learned: 2,
  practiced: 3,
  revised: 4,
  mastered: 5,
};

function getHigherStatus(statusA?: string | null, statusB?: string | null): UserTopicProgress["status"] {
  const pA = STATUS_PRIORITY[statusA || "not_started"] ?? 0;
  const pB = STATUS_PRIORITY[statusB || "not_started"] ?? 0;
  const winner = pB >= pA ? statusB : statusA;
  return (winner as UserTopicProgress["status"]) || "not_started";
}

/**
 * Server-side deterministic, idempotent guest data migration runner.
 * Merges guest domain records into the authenticated user's D1 account.
 */
export async function executeServerMigration(
  db: DatabaseInstance,
  authenticatedUserId: string,
  payload: GuestMigrationPayload
): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
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

  // Map from guest workspace ID to resolved authenticated workspace ID
  const workspaceIdMap = new Map<string, string>();

  // 1. Migrate Workspaces
  const guestWorkspaces = payload.workspaces || [];
  if (guestWorkspaces.length > 0) {
    const existingWorkspaces = await db
      .select()
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, authenticatedUserId));

    for (const gw of guestWorkspaces) {
      if (!gw.examAttemptId) continue;

      // Check if user already has a workspace for this exam attempt
      const existing = existingWorkspaces.find((ew) => ew.examAttemptId === gw.examAttemptId);
      if (existing) {
        // Reuse existing workspace ID
        if (gw.id) workspaceIdMap.set(gw.id, existing.id);
      } else {
        // Insert new workspace for authenticated user
        const newId = `ws_${crypto.randomUUID()}`;
        if (gw.id) workspaceIdMap.set(gw.id, newId);

        await db.insert(userWorkspaces).values({
          id: newId,
          userId: authenticatedUserId,
          examAttemptId: gw.examAttemptId,
          isActive: gw.isActive ?? false,
          startedAt: gw.startedAt ? new Date(gw.startedAt) : new Date(),
          createdAt: gw.createdAt ? new Date(gw.createdAt) : new Date(),
          updatedAt: new Date(),
        });
        summary.workspacesMigrated++;
      }
    }
  }

  // Helper to resolve workspace ID for children entities
  function resolveWorkspaceId(guestWsId?: string | null): string | null {
    if (!guestWsId) return null;
    return workspaceIdMap.get(guestWsId) || null;
  }

  // 2. Migrate Topic Progress
  const guestProgress = payload.topicProgress || [];
  for (const gp of guestProgress) {
    const targetWsId = resolveWorkspaceId(gp.workspaceId);
    if (!targetWsId || !gp.topicId) continue;

    const existingRows = await db
      .select()
      .from(userTopicProgress)
      .where(
        and(
          eq(userTopicProgress.workspaceId, targetWsId),
          eq(userTopicProgress.topicId, gp.topicId)
        )
      )
      .limit(1);

    const existing = existingRows[0];
    if (existing) {
      // Deterministic merge
      const mergedStatus = getHigherStatus(existing.status, gp.status);
      const attempts = (existing.practiceAttempts ?? 0) + (gp.practiceAttempts ?? 0);
      const correct = (existing.correctAnswers ?? 0) + (gp.correctAnswers ?? 0);
      const incorrect = (existing.incorrectAnswers ?? 0) + (gp.incorrectAnswers ?? 0);
      const totalAnswers = correct + incorrect;
      const accuracy = totalAnswers > 0 ? Math.round((correct / totalAnswers) * 10000) : 0;

      const lastStudied = [existing.lastStudiedAt, gp.lastStudiedAt]
        .filter(Boolean)
        .map((d) => new Date(d as string | number | Date).getTime());
      const maxLastStudied = lastStudied.length > 0 ? new Date(Math.max(...lastStudied)) : null;

      const lastRevised = [existing.lastRevisedAt, gp.lastRevisedAt]
        .filter(Boolean)
        .map((d) => new Date(d as string | number | Date).getTime());
      const maxLastRevised = lastRevised.length > 0 ? new Date(Math.max(...lastRevised)) : null;

      const notes = [existing.notes, gp.notes].filter(Boolean).join("\n---\n") || null;

      await db
        .update(userTopicProgress)
        .set({
          status: mergedStatus,
          practiceAttempts: attempts,
          correctAnswers: correct,
          incorrectAnswers: incorrect,
          accuracy,
          lastStudiedAt: maxLastStudied,
          lastRevisedAt: maxLastRevised,
          notes,
          updatedAt: new Date(),
        })
        .where(eq(userTopicProgress.id, existing.id));
    } else {
      await db.insert(userTopicProgress).values({
        id: `prog_${crypto.randomUUID()}`,
        workspaceId: targetWsId,
        topicId: gp.topicId,
        status: gp.status || "not_started",
        practiceAttempts: gp.practiceAttempts ?? 0,
        correctAnswers: gp.correctAnswers ?? 0,
        incorrectAnswers: gp.incorrectAnswers ?? 0,
        accuracy: gp.accuracy ?? 0,
        lastStudiedAt: gp.lastStudiedAt ? new Date(gp.lastStudiedAt) : null,
        lastRevisedAt: gp.lastRevisedAt ? new Date(gp.lastRevisedAt) : null,
        nextRevisionAt: gp.nextRevisionAt ? new Date(gp.nextRevisionAt) : null,
        notes: gp.notes ?? null,
        createdAt: gp.createdAt ? new Date(gp.createdAt) : new Date(),
        updatedAt: new Date(),
      });
    }
    summary.topicProgressMigrated++;
  }

  // 3. Migrate Planner Tasks (avoid duplicate matching title & scheduled date)
  const guestTasks = payload.plannerTasks || [];
  for (const gt of guestTasks) {
    const targetWsId = resolveWorkspaceId(gt.workspaceId);
    if (!targetWsId || !gt.title || !gt.scheduledDate) continue;

    const existing = await db
      .select()
      .from(plannerTasks)
      .where(
        and(
          eq(plannerTasks.workspaceId, targetWsId),
          eq(plannerTasks.title, gt.title),
          eq(plannerTasks.scheduledDate, gt.scheduledDate)
        )
      )
      .limit(1);

    if (!existing[0]) {
      await db.insert(plannerTasks).values({
        id: `task_${crypto.randomUUID()}`,
        workspaceId: targetWsId,
        type: gt.type || "study",
        title: gt.title,
        subjectId: gt.subjectId ?? null,
        chapterId: gt.chapterId ?? null,
        topicId: gt.topicId ?? null,
        scheduledDate: gt.scheduledDate,
        startTime: gt.startTime ?? null,
        durationMinutes: gt.durationMinutes ?? 30,
        status: gt.status ?? "upcoming",
        createdAt: gt.createdAt ? new Date(gt.createdAt) : new Date(),
        updatedAt: new Date(),
      });
      summary.plannerTasksMigrated++;
    }
  }

  // 4. Migrate Study Sessions (historical events, deduplicate by ID)
  const guestSessions = payload.studySessions || [];
  for (const gs of guestSessions) {
    const targetWsId = resolveWorkspaceId(gs.workspaceId);
    if (!targetWsId || !gs.durationMinutes || !gs.startedAt) continue;

    const sessionId = gs.id || `sess_${crypto.randomUUID()}`;
    const existing = await db
      .select()
      .from(studySessions)
      .where(eq(studySessions.id, sessionId))
      .limit(1);

    if (!existing[0]) {
      await db.insert(studySessions).values({
        id: sessionId,
        workspaceId: targetWsId,
        plannerTaskId: gs.plannerTaskId ?? null,
        topicId: gs.topicId ?? null,
        durationMinutes: gs.durationMinutes,
        sessionType: gs.sessionType ?? "focused",
        startedAt: new Date(gs.startedAt),
        endedAt: gs.endedAt ? new Date(gs.endedAt) : null,
        createdAt: gs.createdAt ? new Date(gs.createdAt) : new Date(),
        updatedAt: new Date(),
      });
      summary.studySessionsMigrated++;
    }
  }

  // 5. Migrate Revision Items (deduplicate by workspaceId, topicId)
  const guestRevisions = payload.revisionItems || [];
  for (const gr of guestRevisions) {
    const targetWsId = resolveWorkspaceId(gr.workspaceId);
    if (!targetWsId || !gr.topicId) continue;

    const existing = await db
      .select()
      .from(revisionItems)
      .where(
        and(
          eq(revisionItems.workspaceId, targetWsId),
          eq(revisionItems.topicId, gr.topicId)
        )
      )
      .limit(1);

    if (!existing[0]) {
      await db.insert(revisionItems).values({
        id: `rev_${crypto.randomUUID()}`,
        workspaceId: targetWsId,
        topicId: gr.topicId,
        revisionNumber: gr.revisionNumber ?? 1,
        nextRevisionAt: gr.nextRevisionAt ? new Date(gr.nextRevisionAt) : null,
        lastRevisedAt: gr.lastRevisedAt ? new Date(gr.lastRevisedAt) : null,
        status: gr.status ?? "scheduled",
        createdAt: gr.createdAt ? new Date(gr.createdAt) : new Date(),
        updatedAt: new Date(),
      });
      summary.revisionItemsMigrated++;
    }
  }

  // 6. Migrate Practice Sessions (deduplicate by ID)
  const guestPractice = payload.practiceSessions || [];
  for (const gp of guestPractice) {
    const targetWsId = resolveWorkspaceId(gp.workspaceId);
    if (!targetWsId) continue;

    const practiceId = gp.id || `prac_${crypto.randomUUID()}`;
    const existing = await db
      .select()
      .from(practiceSessions)
      .where(eq(practiceSessions.id, practiceId))
      .limit(1);

    if (!existing[0]) {
      await db.insert(practiceSessions).values({
        id: practiceId,
        workspaceId: targetWsId,
        topicId: gp.topicId ?? null,
        questionCount: gp.questionCount ?? 0,
        correct: gp.correct ?? 0,
        incorrect: gp.incorrect ?? 0,
        unattempted: gp.unattempted ?? 0,
        durationMinutes: gp.durationMinutes ?? 0,
        completedAt: gp.completedAt ? new Date(gp.completedAt) : new Date(),
        createdAt: gp.createdAt ? new Date(gp.createdAt) : new Date(),
        updatedAt: new Date(),
      });
      summary.practiceSessionsMigrated++;
    }
  }

  // 7. Migrate Saved Resources (unique constraint on workspaceId, resourceId)
  const guestSaved = payload.savedResources || [];
  for (const sr of guestSaved) {
    const targetWsId = resolveWorkspaceId(sr.workspaceId);
    if (!targetWsId || !sr.resourceId) continue;

    const existing = await db
      .select()
      .from(savedResources)
      .where(
        and(
          eq(savedResources.workspaceId, targetWsId),
          eq(savedResources.resourceId, sr.resourceId)
        )
      )
      .limit(1);

    if (!existing[0]) {
      await db.insert(savedResources).values({
        id: `saved_${crypto.randomUUID()}`,
        workspaceId: targetWsId,
        resourceId: sr.resourceId,
        savedAt: sr.savedAt ? new Date(sr.savedAt) : new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      summary.savedResourcesMigrated++;
    }
  }

  // 8. Migrate Mock Tests & Results
  const guestMocks = payload.mockTests || [];
  const mockIdMap = new Map<string, string>();
  for (const gm of guestMocks) {
    const targetWsId = resolveWorkspaceId(gm.workspaceId);
    if (!targetWsId || !gm.title) continue;

    const mockId = gm.id || `mock_${crypto.randomUUID()}`;
    const existing = await db
      .select()
      .from(mockTests)
      .where(eq(mockTests.id, mockId))
      .limit(1);

    if (existing[0]) {
      if (gm.id) mockIdMap.set(gm.id, existing[0].id);
    } else {
      if (gm.id) mockIdMap.set(gm.id, mockId);

      await db.insert(mockTests).values({
        id: mockId,
        workspaceId: targetWsId,
        title: gm.title,
        type: gm.type || "full_syllabus",
        scheduledAt: gm.scheduledAt ? new Date(gm.scheduledAt) : null,
        durationMinutes: gm.durationMinutes ?? 180,
        source: gm.source ?? null,
        externalUrl: gm.externalUrl ?? null,
        createdAt: gm.createdAt ? new Date(gm.createdAt) : new Date(),
        updatedAt: new Date(),
      });
      summary.mockTestsMigrated++;
    }
  }

  // Migrate Mock Test Results
  const guestResults = payload.mockTestResults || [];
  for (const gr of guestResults) {
    if (!gr.mockTestId) continue;
    const targetMockId = mockIdMap.get(gr.mockTestId) || gr.mockTestId;
    const resId = gr.id || `res_${crypto.randomUUID()}`;

    const existing = await db
      .select()
      .from(mockTestResults)
      .where(eq(mockTestResults.mockTestId, targetMockId))
      .limit(1);

    if (!existing[0]) {
      await db.insert(mockTestResults).values({
        id: resId,
        mockTestId: targetMockId,
        score: gr.score ?? 0,
        totalMarks: gr.totalMarks ?? 720,
        correct: gr.correct ?? 0,
        incorrect: gr.incorrect ?? 0,
        unattempted: gr.unattempted ?? 0,
        accuracy: gr.accuracy ?? 0,
        notes: gr.notes ?? null,
        completedAt: gr.completedAt ? new Date(gr.completedAt) : new Date(),
        createdAt: gr.createdAt ? new Date(gr.createdAt) : new Date(),
        updatedAt: new Date(),
      });
      summary.mockTestResultsMigrated++;
    }
  }

  // 9. Migrate Preferences
  if (payload.preferences) {
    const existingPrefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, authenticatedUserId))
      .limit(1);

    if (!existingPrefs[0]) {
      await db.insert(userPreferences).values({
        userId: authenticatedUserId,
        theme: payload.preferences.theme || "system",
        dailyStudyGoalMinutes: payload.preferences.dailyStudyGoalMinutes ?? 120,
        timezone: payload.preferences.timezone || "Asia/Kolkata",
        preparationStage: payload.preferences.preparationStage ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      // Backfill guest onboarding choices the account does not have yet
      const patch: Record<string, unknown> = {};
      if (
        payload.preferences.preparationStage &&
        !existingPrefs[0].preparationStage
      ) {
        patch.preparationStage = payload.preferences.preparationStage;
      }
      if (
        typeof payload.preferences.dailyStudyGoalMinutes === "number" &&
        existingPrefs[0].dailyStudyGoalMinutes === 120 &&
        payload.preferences.dailyStudyGoalMinutes !== 120
      ) {
        patch.dailyStudyGoalMinutes = payload.preferences.dailyStudyGoalMinutes;
      }
      if (Object.keys(patch).length > 0) {
        await db
          .update(userPreferences)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(userPreferences.userId, authenticatedUserId));
      }
    }
  }

  if (payload.notificationPreferences) {
    const existingNotifs = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, authenticatedUserId))
      .limit(1);

    if (!existingNotifs[0]) {
      await db.insert(notificationPreferences).values({
        userId: authenticatedUserId,
        studyReminders: payload.notificationPreferences.studyReminders ?? true,
        revisionReminders: payload.notificationPreferences.revisionReminders ?? true,
        mockTestReminders: payload.notificationPreferences.mockTestReminders ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return summary;
}

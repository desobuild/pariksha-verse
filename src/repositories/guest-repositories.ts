import type { StorageAdapter } from "@/lib/storage/types";
import { appStorage } from "@/lib/storage";
import type {
  StudySessionCreateInput,
  TopicProgressUpsertInput,
} from "@/domain/study";
import type { RevisionItemUpsertInput } from "@/domain/revision";
import type { PracticeSessionCreateInput } from "@/domain/practice";
import type {
  DomainRepositories,
  WorkspaceRepositoryInterface,
  TopicProgressRepositoryInterface,
  PlannerRepositoryInterface,
  StudySessionRepositoryInterface,
  RevisionRepositoryInterface,
  PracticeRepositoryInterface,
  SavedResourceRepositoryInterface,
  MockTestRepositoryInterface,
  PreferencesRepositoryInterface,
  QuestionRepositoryInterface,
  QuestionSessionRepositoryInterface,
} from "./interfaces";
import {
  FIXTURE_QUESTIONS,
  filterQuestionsByScope,
  selectQuestionsForSession,
  gradeQuestionSession,
  type QuestionWithOptions,
  type PracticeScope,
  type CreateQuestionSessionInput,
  type QuestionSessionWithAttempts,
  type QuestionSessionResult,
} from "@/domain/practice-engine";
import { applyPracticeSessionToProgress } from "@/domain/practice";
import { getTopicMetadata } from "@/domain/dashboard";
import type {
  UserWorkspace,
  NewUserWorkspace,
  UserTopicProgress,
  PlannerTask,
  NewPlannerTask,
  StudySession,
  RevisionItem,
  PracticeSession,
  SavedResource,
  NewSavedResource,
  NewMockTest,
  MockTestResult,
  NewMockTestResult,
  UserPreferences,
  NewUserPreferences,
  NotificationPreferences,
  NewNotificationPreferences,
} from "@/db/schema";
import {
  createFixtureMocksForWorkspace,
  selectMockQuestions,
  calculateMockResult,
  type MockTestDetail,
  type MockTestSessionDetail,
  type MockTestResultDetail,
  type MockSessionStatus,
  type MockMarkingScheme,
  type MockSectionConfig,
} from "@/domain/mock-engine";

export const GUEST_STORAGE_KEYS = {
  WORKSPACES: "guest:workspaces",
  TOPIC_PROGRESS: "guest:topic_progress",
  PLANNER_TASKS: "guest:planner_tasks",
  STUDY_SESSIONS: "guest:study_sessions",
  REVISION_ITEMS: "guest:revision_items",
  PRACTICE_SESSIONS: "guest:practice_sessions",
  SAVED_RESOURCES: "guest:saved_resources",
  MOCK_TESTS: "guest:mock_tests",
  MOCK_TEST_RESULTS: "guest:mock_test_results",
  MOCK_TEST_SESSIONS: "guest:mock_test_sessions",
  USER_PREFERENCES: "guest:user_preferences",
  NOTIFICATION_PREFERENCES: "guest:notification_preferences",
  QUESTION_SESSIONS: "guest:question_sessions",
  QUESTION_ATTEMPTS: "guest:question_attempts",
};

export class GuestWorkspaceRepository implements WorkspaceRepositoryInterface {
  constructor(private storage: StorageAdapter = appStorage, private guestId: string = "guest_default") {}

  async getWorkspaceById(id: string): Promise<UserWorkspace | null> {
    const list = (await this.storage.getItem<UserWorkspace[]>(GUEST_STORAGE_KEYS.WORKSPACES)) || [];
    return list.find((w) => w.id === id) || null;
  }

  async getWorkspaces(): Promise<UserWorkspace[]> {
    return (await this.storage.getItem<UserWorkspace[]>(GUEST_STORAGE_KEYS.WORKSPACES)) || [];
  }

  async getActiveWorkspace(): Promise<UserWorkspace | null> {
    const list = await this.getWorkspaces();
    return list.find((w) => w.isActive) || list[0] || null;
  }

  async getWorkspaceForAttempt(examAttemptId: string): Promise<UserWorkspace | null> {
    const list = await this.getWorkspaces();
    return list.find((w) => w.examAttemptId === examAttemptId) || null;
  }

  async ensureWorkspaceForAttempt(examAttemptId: string): Promise<UserWorkspace> {
    const existing = await this.getWorkspaceForAttempt(examAttemptId);
    if (existing) {
      // Deterministic reuse: activate the existing workspace instead of duplicating
      if (!existing.isActive) {
        await this.setActiveWorkspace(existing.id);
        existing.isActive = true;
      }
      return existing;
    }
    return this.createWorkspace({
      examAttemptId,
      isActive: true,
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async createWorkspace(
    data: Omit<NewUserWorkspace, "userId" | "id"> & { id?: string; userId?: string }
  ): Promise<UserWorkspace> {
    const list = await this.getWorkspaces();
    const newWs: UserWorkspace = {
      id: data.id || `ws_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: this.guestId,
      examAttemptId: data.examAttemptId,
      isActive: data.isActive ?? true,
      startedAt: data.startedAt instanceof Date ? data.startedAt : new Date(data.startedAt),
      createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(),
      updatedAt: data.updatedAt instanceof Date ? data.updatedAt : new Date(),
    };

    if (newWs.isActive) {
      for (const item of list) {
        item.isActive = false;
      }
    }

    list.push(newWs);
    await this.storage.setItem(GUEST_STORAGE_KEYS.WORKSPACES, list);
    return newWs;
  }

  async setActiveWorkspace(workspaceId: string): Promise<void> {
    const list = await this.getWorkspaces();
    for (const item of list) {
      item.isActive = item.id === workspaceId;
      item.updatedAt = new Date();
    }
    await this.storage.setItem(GUEST_STORAGE_KEYS.WORKSPACES, list);
  }
}

export class GuestTopicProgressRepository implements TopicProgressRepositoryInterface {
  constructor(private storage: StorageAdapter = appStorage) {}

  async getProgress(workspaceId: string, topicId: string): Promise<UserTopicProgress | null> {
    const list = (await this.storage.getItem<UserTopicProgress[]>(GUEST_STORAGE_KEYS.TOPIC_PROGRESS)) || [];
    return list.find((p) => p.workspaceId === workspaceId && p.topicId === topicId) || null;
  }

  async getAllProgressForWorkspace(workspaceId: string): Promise<UserTopicProgress[]> {
    const list = (await this.storage.getItem<UserTopicProgress[]>(GUEST_STORAGE_KEYS.TOPIC_PROGRESS)) || [];
    return list.filter((p) => p.workspaceId === workspaceId);
  }

  async upsertProgress(data: TopicProgressUpsertInput): Promise<UserTopicProgress> {
    const list = (await this.storage.getItem<UserTopicProgress[]>(GUEST_STORAGE_KEYS.TOPIC_PROGRESS)) || [];
    const index = list.findIndex((p) => p.workspaceId === data.workspaceId && p.topicId === data.topicId);

    const record: UserTopicProgress = {
      id: data.id || `prog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: data.workspaceId,
      topicId: data.topicId,
      status: data.status ?? "not_started",
      startedAt: data.startedAt ? (data.startedAt instanceof Date ? data.startedAt : new Date(data.startedAt)) : null,
      learnedAt: data.learnedAt ? (data.learnedAt instanceof Date ? data.learnedAt : new Date(data.learnedAt)) : null,
      practicedAt: data.practicedAt ? (data.practicedAt instanceof Date ? data.practicedAt : new Date(data.practicedAt)) : null,
      revisedAt: data.revisedAt ? (data.revisedAt instanceof Date ? data.revisedAt : new Date(data.revisedAt)) : null,
      masteredAt: data.masteredAt ? (data.masteredAt instanceof Date ? data.masteredAt : new Date(data.masteredAt)) : null,
      practiceAttempts: data.practiceAttempts ?? 0,
      correctAnswers: data.correctAnswers ?? 0,
      incorrectAnswers: data.incorrectAnswers ?? 0,
      accuracy: data.accuracy ?? 0,
      lastStudiedAt: data.lastStudiedAt ? (data.lastStudiedAt instanceof Date ? data.lastStudiedAt : new Date(data.lastStudiedAt)) : null,
      lastRevisedAt: data.lastRevisedAt ? (data.lastRevisedAt instanceof Date ? data.lastRevisedAt : new Date(data.lastRevisedAt)) : null,
      nextRevisionAt: data.nextRevisionAt ? (data.nextRevisionAt instanceof Date ? data.nextRevisionAt : new Date(data.nextRevisionAt)) : null,
      notes: data.notes ?? null,
      createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(),
      updatedAt: new Date(),
    };

    if (index >= 0) {
      list[index] = { ...list[index], ...record, id: list[index].id };
    } else {
      list.push(record);
    }

    await this.storage.setItem(GUEST_STORAGE_KEYS.TOPIC_PROGRESS, list);
    return index >= 0 ? list[index] : record;
  }
}

export class GuestPlannerRepository implements PlannerRepositoryInterface {
  constructor(private storage: StorageAdapter = appStorage) {}

  async getTasksForWorkspace(workspaceId: string): Promise<PlannerTask[]> {
    const list = (await this.storage.getItem<PlannerTask[]>(GUEST_STORAGE_KEYS.PLANNER_TASKS)) || [];
    return list.filter((t) => t.workspaceId === workspaceId);
  }

  async createTask(data: NewPlannerTask): Promise<PlannerTask> {
    const list = (await this.storage.getItem<PlannerTask[]>(GUEST_STORAGE_KEYS.PLANNER_TASKS)) || [];
    const record: PlannerTask = {
      id: data.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: data.workspaceId,
      type: data.type,
      title: data.title,
      subjectId: data.subjectId ?? null,
      chapterId: data.chapterId ?? null,
      topicId: data.topicId ?? null,
      scheduledDate: data.scheduledDate,
      startTime: data.startTime ?? null,
      durationMinutes: data.durationMinutes,
      status: data.status ?? "upcoming",
      createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(),
      updatedAt: new Date(),
    };
    list.push(record);
    await this.storage.setItem(GUEST_STORAGE_KEYS.PLANNER_TASKS, list);
    return record;
  }

  async updateTaskStatus(taskId: string, status: PlannerTask["status"]): Promise<void> {
    const list = (await this.storage.getItem<PlannerTask[]>(GUEST_STORAGE_KEYS.PLANNER_TASKS)) || [];
    const task = list.find((t) => t.id === taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date();
      await this.storage.setItem(GUEST_STORAGE_KEYS.PLANNER_TASKS, list);
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    const list = (await this.storage.getItem<PlannerTask[]>(GUEST_STORAGE_KEYS.PLANNER_TASKS)) || [];
    const filtered = list.filter((t) => t.id !== taskId);
    await this.storage.setItem(GUEST_STORAGE_KEYS.PLANNER_TASKS, filtered);
  }
}

export class GuestStudySessionRepository implements StudySessionRepositoryInterface {
  constructor(private storage: StorageAdapter = appStorage) {}

  async getSessionsForWorkspace(workspaceId: string): Promise<StudySession[]> {
    const list = (await this.storage.getItem<StudySession[]>(GUEST_STORAGE_KEYS.STUDY_SESSIONS)) || [];
    return list.filter((s) => s.workspaceId === workspaceId);
  }

  async createSession(data: StudySessionCreateInput): Promise<StudySession> {
    const list = (await this.storage.getItem<StudySession[]>(GUEST_STORAGE_KEYS.STUDY_SESSIONS)) || [];
    const record: StudySession = {
      id: data.id || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: data.workspaceId,
      plannerTaskId: data.plannerTaskId ?? null,
      topicId: data.topicId ?? null,
      durationMinutes: data.durationMinutes ?? 0,
      sessionType: data.sessionType ?? "focused",
      startedAt: data.startedAt instanceof Date ? data.startedAt : new Date(data.startedAt),
      endedAt: data.endedAt ? (data.endedAt instanceof Date ? data.endedAt : new Date(data.endedAt)) : null,
      createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(),
      updatedAt: new Date(),
    };
    list.push(record);
    await this.storage.setItem(GUEST_STORAGE_KEYS.STUDY_SESSIONS, list);
    return record;
  }
}

export class GuestRevisionRepository implements RevisionRepositoryInterface {
  constructor(private storage: StorageAdapter = appStorage) {}

  async getRevisionItems(workspaceId: string): Promise<RevisionItem[]> {
    const list = (await this.storage.getItem<RevisionItem[]>(GUEST_STORAGE_KEYS.REVISION_ITEMS)) || [];
    return list.filter((r) => r.workspaceId === workspaceId);
  }

  async upsertRevisionItem(data: RevisionItemUpsertInput): Promise<RevisionItem> {
    const list = (await this.storage.getItem<RevisionItem[]>(GUEST_STORAGE_KEYS.REVISION_ITEMS)) || [];
    const index = list.findIndex((r) => r.workspaceId === data.workspaceId && r.topicId === data.topicId);
    const record: RevisionItem = {
      id: data.id || `rev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: data.workspaceId,
      topicId: data.topicId,
      revisionNumber: data.revisionNumber ?? 1,
      nextRevisionAt: data.nextRevisionAt ? (data.nextRevisionAt instanceof Date ? data.nextRevisionAt : new Date(data.nextRevisionAt)) : null,
      lastRevisedAt: data.lastRevisedAt ? (data.lastRevisedAt instanceof Date ? data.lastRevisedAt : new Date(data.lastRevisedAt)) : null,
      status: data.status ?? "scheduled",
      createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(),
      updatedAt: new Date(),
    };
    if (index >= 0) {
      list[index] = { ...list[index], ...record, id: list[index].id };
    } else {
      list.push(record);
    }
    await this.storage.setItem(GUEST_STORAGE_KEYS.REVISION_ITEMS, list);
    return index >= 0 ? list[index] : record;
  }
}

export class GuestPracticeRepository implements PracticeRepositoryInterface {
  constructor(private storage: StorageAdapter = appStorage) {}

  async getPracticeSessions(workspaceId: string): Promise<PracticeSession[]> {
    const list = (await this.storage.getItem<PracticeSession[]>(GUEST_STORAGE_KEYS.PRACTICE_SESSIONS)) || [];
    return list
      .filter((p) => p.workspaceId === workspaceId)
      .map((p) => ({
        ...p,
        completedAt: p.completedAt instanceof Date ? p.completedAt : new Date(p.completedAt),
        createdAt: p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt),
        updatedAt: p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt),
      }));
  }

  async createPracticeSession(data: PracticeSessionCreateInput): Promise<PracticeSession> {
    const list = (await this.storage.getItem<PracticeSession[]>(GUEST_STORAGE_KEYS.PRACTICE_SESSIONS)) || [];
    const record: PracticeSession = {
      id: data.id || `prac_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: data.workspaceId,
      topicId: data.topicId ?? null,
      questionCount: data.questionCount ?? 0,
      correct: data.correct ?? 0,
      incorrect: data.incorrect ?? 0,
      unattempted: data.unattempted ?? 0,
      durationMinutes: data.durationMinutes ?? 0,
      completedAt: data.completedAt instanceof Date ? data.completedAt : new Date(data.completedAt),
      createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(),
      updatedAt: new Date(),
    };
    list.push(record);
    await this.storage.setItem(GUEST_STORAGE_KEYS.PRACTICE_SESSIONS, list);
    return record;
  }
}

export class GuestSavedResourceRepository implements SavedResourceRepositoryInterface {
  constructor(private storage: StorageAdapter = appStorage) {}

  async getSavedResources(workspaceId: string): Promise<SavedResource[]> {
    const list = (await this.storage.getItem<SavedResource[]>(GUEST_STORAGE_KEYS.SAVED_RESOURCES)) || [];
    return list.filter((r) => r.workspaceId === workspaceId);
  }

  async saveResource(data: NewSavedResource): Promise<SavedResource> {
    const list = (await this.storage.getItem<SavedResource[]>(GUEST_STORAGE_KEYS.SAVED_RESOURCES)) || [];
    const existing = list.find((r) => r.workspaceId === data.workspaceId && r.resourceId === data.resourceId);
    if (existing) return existing;

    const record: SavedResource = {
      id: data.id || `saved_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: data.workspaceId,
      resourceId: data.resourceId,
      savedAt: data.savedAt instanceof Date ? data.savedAt : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    list.push(record);
    await this.storage.setItem(GUEST_STORAGE_KEYS.SAVED_RESOURCES, list);
    return record;
  }

  async removeSavedResource(workspaceId: string, resourceId: string): Promise<void> {
    const list = (await this.storage.getItem<SavedResource[]>(GUEST_STORAGE_KEYS.SAVED_RESOURCES)) || [];
    const filtered = list.filter((r) => !(r.workspaceId === workspaceId && r.resourceId === resourceId));
    await this.storage.setItem(GUEST_STORAGE_KEYS.SAVED_RESOURCES, filtered);
  }
}

interface StoredGuestMockSession {
  id: string;
  mockTestId: string;
  workspaceId: string;
  status: MockSessionStatus;
  questionIds: string[];
  selectedAnswers: Record<string, string | null>;
  markedForReview: string[];
  currentIndex: number;
  durationSeconds: number;
  startedAt: string;
  expiresAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class GuestMockTestRepository implements MockTestRepositoryInterface {
  constructor(
    private storage: StorageAdapter = appStorage,
    private questionRepo?: QuestionRepositoryInterface,
    private practiceRepo?: PracticeRepositoryInterface,
    private progressRepo?: TopicProgressRepositoryInterface
  ) {}

  private getQuestionsRepo(): QuestionRepositoryInterface {
    return this.questionRepo || new GuestQuestionRepository();
  }

  private getPracticeRepo(): PracticeRepositoryInterface {
    return this.practiceRepo || new GuestPracticeRepository(this.storage);
  }

  private getProgressRepo(): TopicProgressRepositoryInterface {
    return this.progressRepo || new GuestTopicProgressRepository(this.storage);
  }

  private reviveMockTest(m: MockTestDetail): MockTestDetail {
    return {
      ...m,
      createdAt: new Date(m.createdAt),
      updatedAt: new Date(m.updatedAt),
      scheduledAt: m.scheduledAt ? new Date(m.scheduledAt) : null,
    };
  }

  private reviveResult(r: MockTestResultDetail): MockTestResultDetail {
    return {
      ...r,
      completedAt: new Date(r.completedAt),
    };
  }

  async getMockTests(workspaceId: string): Promise<MockTestDetail[]> {
    const list = (await this.storage.getItem<MockTestDetail[]>(GUEST_STORAGE_KEYS.MOCK_TESTS)) || [];
    const forWorkspace = list.filter((m) => m.workspaceId === workspaceId);

    if (forWorkspace.length > 0) {
      return forWorkspace.map((m) => this.reviveMockTest(m));
    }

    // Seed fixture mocks for workspace if none exist
    const seeded = createFixtureMocksForWorkspace(workspaceId);
    list.push(...seeded);
    await this.storage.setItem(GUEST_STORAGE_KEYS.MOCK_TESTS, list);
    return seeded.map((m) => this.reviveMockTest(m));
  }

  async getMockTestById(id: string, workspaceId: string): Promise<MockTestDetail | null> {
    const tests = await this.getMockTests(workspaceId);
    return tests.find((m) => m.id === id) || null;
  }

  async createMockTest(data: NewMockTest): Promise<MockTestDetail> {
    const list = (await this.storage.getItem<MockTestDetail[]>(GUEST_STORAGE_KEYS.MOCK_TESTS)) || [];
    const now = new Date();

    let markingScheme: MockMarkingScheme = {
      correctMarks: 4,
      incorrectPenalty: 1,
      unansweredMarks: 0,
    };
    if (data.markingScheme) {
      try {
        markingScheme = JSON.parse(data.markingScheme);
      } catch {
        // Fallback default
      }
    }

    let sections: MockSectionConfig[] = [];
    if (data.sections) {
      try {
        sections = JSON.parse(data.sections);
      } catch {
        // Fallback empty
      }
    }

    const record: MockTestDetail = {
      id: data.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: data.workspaceId,
      examId: data.examId ?? null,
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      scheduledAt: data.scheduledAt ? (data.scheduledAt instanceof Date ? data.scheduledAt : new Date(data.scheduledAt)) : null,
      durationMinutes: data.durationMinutes,
      totalQuestions: data.totalQuestions || 0,
      markingScheme,
      sections,
      questionSelectionConfig: null,
      source: data.source ?? null,
      externalUrl: data.externalUrl ?? null,
      provenance: (data.provenance as MockTestDetail["provenance"]) || "fixture",
      status: (data.status as MockTestDetail["status"]) || "active",
      createdAt: data.createdAt instanceof Date ? data.createdAt : now,
      updatedAt: now,
    };

    list.push(record);
    await this.storage.setItem(GUEST_STORAGE_KEYS.MOCK_TESTS, list);
    return this.reviveMockTest(record);
  }

  async createSession(params: {
    workspaceId: string;
    mockTestId: string;
    seed?: number;
  }): Promise<MockTestSessionDetail> {
    const { workspaceId, mockTestId, seed = 42 } = params;
    const mock = await this.getMockTestById(mockTestId, workspaceId);
    if (!mock) {
      throw new Error(`Mock test ${mockTestId} not found`);
    }

    // Check existing active session
    const sessions = (await this.storage.getItem<StoredGuestMockSession[]>(GUEST_STORAGE_KEYS.MOCK_TESTS + "_sessions")) ||
      (await this.storage.getItem<StoredGuestMockSession[]>(GUEST_STORAGE_KEYS.MOCK_TEST_SESSIONS)) || [];

    const existing = sessions.find(
      (s) => s.workspaceId === workspaceId && s.mockTestId === mockTestId && s.status === "in_progress"
    );

    if (existing) {
      const expiresAt = new Date(existing.expiresAt);
      if (Date.now() < expiresAt.getTime()) {
        const fullSess = await this.getSession(existing.id, workspaceId);
        if (fullSess) return fullSess;
      }
    }

    const allQuestions = await this.getQuestionsRepo().getAllQuestions();
    const selectedQuestions = selectMockQuestions(allQuestions, mock, seed);

    const now = new Date();
    const durationSeconds = mock.durationMinutes * 60;
    const expiresAt = new Date(now.getTime() + durationSeconds * 1000);
    const sessionId = `sess_mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const questionIds = selectedQuestions.map((q) => q.id);

    const storedSession: StoredGuestMockSession = {
      id: sessionId,
      mockTestId,
      workspaceId,
      status: "in_progress",
      questionIds,
      selectedAnswers: {},
      markedForReview: [],
      currentIndex: 0,
      durationSeconds,
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      completedAt: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    sessions.push(storedSession);
    await this.storage.setItem(GUEST_STORAGE_KEYS.MOCK_TEST_SESSIONS, sessions);

    return {
      id: sessionId,
      mockTestId,
      workspaceId,
      status: "in_progress",
      questionIds,
      selectedAnswers: {},
      markedForReview: [],
      currentIndex: 0,
      durationSeconds,
      startedAt: now,
      expiresAt,
      completedAt: null,
      questions: selectedQuestions,
      mockTest: mock,
    };
  }

  async getSession(sessionId: string, workspaceId: string): Promise<MockTestSessionDetail | null> {
    const sessions = (await this.storage.getItem<StoredGuestMockSession[]>(GUEST_STORAGE_KEYS.MOCK_TEST_SESSIONS)) || [];
    const sess = sessions.find((s) => s.id === sessionId && s.workspaceId === workspaceId);
    if (!sess) return null;

    const mock = await this.getMockTestById(sess.mockTestId, workspaceId);
    if (!mock) return null;

    const expiresAt = new Date(sess.expiresAt);

    // Auto-submit if in_progress and time expired
    if (sess.status === "in_progress" && Date.now() >= expiresAt.getTime()) {
      await this.submitSession({
        workspaceId,
        sessionId,
        submissionStatus: "auto_submitted",
        completedAt: expiresAt,
      });
      return this.getSession(sessionId, workspaceId);
    }

    const questions: QuestionWithOptions[] = [];
    for (const qid of sess.questionIds) {
      const q = await this.getQuestionsRepo().getQuestionById(qid);
      if (q) questions.push(q);
    }

    return {
      id: sess.id,
      mockTestId: sess.mockTestId,
      workspaceId: sess.workspaceId,
      status: sess.status,
      questionIds: sess.questionIds,
      selectedAnswers: sess.selectedAnswers || {},
      markedForReview: sess.markedForReview || [],
      currentIndex: sess.currentIndex || 0,
      durationSeconds: sess.durationSeconds,
      startedAt: new Date(sess.startedAt),
      expiresAt,
      completedAt: sess.completedAt ? new Date(sess.completedAt) : null,
      questions,
      mockTest: mock,
    };
  }

  async updateSessionAnswer(params: {
    workspaceId: string;
    sessionId: string;
    questionId: string;
    selectedOptionId?: string | null;
    isMarkedForReview?: boolean;
    currentIndex?: number;
  }): Promise<void> {
    const { workspaceId, sessionId, questionId, selectedOptionId, isMarkedForReview, currentIndex } = params;
    const sessions = (await this.storage.getItem<StoredGuestMockSession[]>(GUEST_STORAGE_KEYS.MOCK_TEST_SESSIONS)) || [];
    const sess = sessions.find((s) => s.id === sessionId && s.workspaceId === workspaceId);
    if (!sess || sess.status !== "in_progress") return;

    const expiresAt = new Date(sess.expiresAt);
    if (Date.now() >= expiresAt.getTime()) {
      await this.submitSession({
        workspaceId,
        sessionId,
        submissionStatus: "auto_submitted",
        completedAt: expiresAt,
      });
      return;
    }

    if (selectedOptionId !== undefined) {
      if (!sess.selectedAnswers) sess.selectedAnswers = {};
      sess.selectedAnswers[questionId] = selectedOptionId;
    }

    if (isMarkedForReview !== undefined) {
      if (!sess.markedForReview) sess.markedForReview = [];
      const index = sess.markedForReview.indexOf(questionId);
      if (isMarkedForReview && index === -1) {
        sess.markedForReview.push(questionId);
      } else if (!isMarkedForReview && index !== -1) {
        sess.markedForReview.splice(index, 1);
      }
    }

    if (currentIndex !== undefined) {
      sess.currentIndex = currentIndex;
    }

    sess.updatedAt = new Date().toISOString();
    await this.storage.setItem(GUEST_STORAGE_KEYS.MOCK_TEST_SESSIONS, sessions);
  }

  async submitSession(params: {
    workspaceId: string;
    sessionId: string;
    submissionStatus?: "completed" | "auto_submitted";
    answers?: Record<string, string | null>;
    markedForReview?: string[];
    completedAt?: Date;
  }): Promise<MockTestResultDetail> {
    const {
      workspaceId,
      sessionId,
      submissionStatus = "completed",
      answers,
      markedForReview,
      completedAt = new Date(),
    } = params;

    const sessions = (await this.storage.getItem<StoredGuestMockSession[]>(GUEST_STORAGE_KEYS.MOCK_TEST_SESSIONS)) || [];
    const sess = sessions.find((s) => s.id === sessionId && s.workspaceId === workspaceId);
    if (!sess) {
      throw new Error(`Mock test session ${sessionId} not found`);
    }

    // If already submitted, return existing result
    if (sess.status === "completed" || sess.status === "auto_submitted") {
      const existingRes = await this.getResultBySessionId(sessionId, workspaceId);
      if (existingRes) return existingRes;
    }

    const mock = await this.getMockTestById(sess.mockTestId, workspaceId);
    if (!mock) {
      throw new Error(`Mock test ${sess.mockTestId} not found`);
    }

    const effectiveAnswers = { ...(sess.selectedAnswers || {}), ...(answers || {}) };
    const effectiveMarked = markedForReview || sess.markedForReview || [];

    const questions: QuestionWithOptions[] = [];
    for (const qid of sess.questionIds) {
      const q = await this.getQuestionsRepo().getQuestionById(qid);
      if (q) questions.push(q);
    }

    const result = calculateMockResult({
      mockTest: mock,
      sessionId,
      workspaceId,
      questions,
      answers: effectiveAnswers,
      markedForReview: effectiveMarked,
      startedAt: new Date(sess.startedAt),
      completedAt,
      submissionStatus,
      metadataResolver: (topicId) => getTopicMetadata(topicId),
    });

    // 1. Update session status
    sess.status = submissionStatus;
    sess.selectedAnswers = effectiveAnswers;
    sess.markedForReview = effectiveMarked;
    sess.completedAt = result.completedAt.toISOString();
    sess.updatedAt = result.completedAt.toISOString();
    await this.storage.setItem(GUEST_STORAGE_KEYS.MOCK_TEST_SESSIONS, sessions);

    // 2. Persist result
    const results = (await this.storage.getItem<MockTestResultDetail[]>(GUEST_STORAGE_KEYS.MOCK_TEST_RESULTS)) || [];
    const existingIdx = results.findIndex((r) => r.sessionId === sessionId);
    if (existingIdx >= 0) {
      results[existingIdx] = result;
    } else {
      results.push(result);
    }
    await this.storage.setItem(GUEST_STORAGE_KEYS.MOCK_TEST_RESULTS, results);

    // 3. Integrate with Phase 9 Practice Performance & Progress
    const topicStatsMap = new Map<string, { attempted: number; correct: number; incorrect: number }>();
    for (const item of result.questions) {
      if (item.isAttempted) {
        const cur = topicStatsMap.get(item.topicId) || { attempted: 0, correct: 0, incorrect: 0 };
        cur.attempted++;
        if (item.isCorrect) cur.correct++;
        else cur.incorrect++;
        topicStatsMap.set(item.topicId, cur);
      }
    }

    const pracRepo = this.getPracticeRepo();
    const progRepo = this.getProgressRepo();

    for (const [topicId, stats] of topicStatsMap.entries()) {
      if (stats.attempted > 0) {
        const newPracSession = await pracRepo.createPracticeSession({
          workspaceId,
          topicId,
          questionCount: stats.attempted,
          correct: stats.correct,
          incorrect: stats.incorrect,
          unattempted: 0,
          durationMinutes: Math.max(1, Math.round(result.timeSpentSeconds / 60)),
          completedAt: result.completedAt,
        });

        const [existingProgress, allSessions] = await Promise.all([
          progRepo.getProgress(workspaceId, topicId),
          pracRepo.getPracticeSessions(workspaceId),
        ]);

        const topicSessions = allSessions.filter((s) => s.topicId === topicId);
        if (!topicSessions.some((s) => s.id === newPracSession.id)) {
          topicSessions.push(newPracSession);
        }

        const progressPatch = applyPracticeSessionToProgress({
          workspaceId,
          topicId,
          existingProgress,
          sessions: topicSessions,
          completedAt: result.completedAt,
        });

        await progRepo.upsertProgress(progressPatch);
      }
    }

    return this.reviveResult(result);
  }

  async saveResult(data: NewMockTestResult): Promise<MockTestResult> {
    const list = (await this.storage.getItem<MockTestResult[]>(GUEST_STORAGE_KEYS.MOCK_TEST_RESULTS + "_legacy")) || [];
    const record: MockTestResult = {
      id: data.id || `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      mockTestId: data.mockTestId,
      score: data.score,
      totalMarks: data.totalMarks,
      correct: data.correct ?? 0,
      incorrect: data.incorrect ?? 0,
      unattempted: data.unattempted ?? 0,
      accuracy: data.accuracy ?? 0,
      notes: data.notes ?? null,
      completedAt: data.completedAt instanceof Date ? data.completedAt : new Date(data.completedAt),
      createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(),
      updatedAt: new Date(),
      sessionId: data.sessionId ?? null,
      timeSpentSeconds: data.timeSpentSeconds ?? 0,
      submissionStatus: data.submissionStatus ?? "completed",
      sectionResults: data.sectionResults ?? null,
      questionResults: data.questionResults ?? null,
    };
    list.push(record);
    await this.storage.setItem(GUEST_STORAGE_KEYS.MOCK_TEST_RESULTS + "_legacy", list);
    return record;
  }

  async getResult(mockTestId: string, workspaceId?: string): Promise<MockTestResultDetail | null> {
    const list = (await this.storage.getItem<MockTestResultDetail[]>(GUEST_STORAGE_KEYS.MOCK_TEST_RESULTS)) || [];
    const match = list.find((r) => r.mockTestId === mockTestId && (!workspaceId || r.workspaceId === workspaceId));
    return match ? this.reviveResult(match) : null;
  }

  async getResultBySessionId(sessionId: string, workspaceId: string): Promise<MockTestResultDetail | null> {
    const list = (await this.storage.getItem<MockTestResultDetail[]>(GUEST_STORAGE_KEYS.MOCK_TEST_RESULTS)) || [];
    const match = list.find((r) => r.sessionId === sessionId && r.workspaceId === workspaceId);
    return match ? this.reviveResult(match) : null;
  }

  async getAllResultsForWorkspace(workspaceId: string): Promise<MockTestResultDetail[]> {
    const list = (await this.storage.getItem<MockTestResultDetail[]>(GUEST_STORAGE_KEYS.MOCK_TEST_RESULTS)) || [];
    return list
      .filter((r) => r.workspaceId === workspaceId)
      .map((r) => this.reviveResult(r))
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
  }
}

export class GuestPreferencesRepository implements PreferencesRepositoryInterface {
  constructor(private storage: StorageAdapter = appStorage, private guestId: string = "guest_default") {}

  async getUserPreferences(): Promise<UserPreferences | null> {
    return (await this.storage.getItem<UserPreferences>(GUEST_STORAGE_KEYS.USER_PREFERENCES)) || null;
  }

  async saveUserPreferences(data: Partial<NewUserPreferences>): Promise<UserPreferences> {
    const existing = await this.getUserPreferences();
    const record: UserPreferences = {
      userId: this.guestId,
      theme: data.theme ?? existing?.theme ?? "system",
      dailyStudyGoalMinutes: data.dailyStudyGoalMinutes ?? existing?.dailyStudyGoalMinutes ?? 120,
      timezone: data.timezone ?? existing?.timezone ?? "Asia/Kolkata",
      preparationStage: data.preparationStage ?? existing?.preparationStage ?? null,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    await this.storage.setItem(GUEST_STORAGE_KEYS.USER_PREFERENCES, record);
    return record;
  }

  async getNotificationPreferences(): Promise<NotificationPreferences | null> {
    return (await this.storage.getItem<NotificationPreferences>(GUEST_STORAGE_KEYS.NOTIFICATION_PREFERENCES)) || null;
  }

  async saveNotificationPreferences(data: Partial<NewNotificationPreferences>): Promise<NotificationPreferences> {
    const existing = await this.getNotificationPreferences();
    const record: NotificationPreferences = {
      userId: this.guestId,
      studyReminders: data.studyReminders ?? existing?.studyReminders ?? true,
      revisionReminders: data.revisionReminders ?? existing?.revisionReminders ?? true,
      mockTestReminders: data.mockTestReminders ?? existing?.mockTestReminders ?? true,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    await this.storage.setItem(GUEST_STORAGE_KEYS.NOTIFICATION_PREFERENCES, record);
    return record;
  }
}

export class GuestQuestionRepository implements QuestionRepositoryInterface {
  async getQuestionById(id: string): Promise<QuestionWithOptions | null> {
    const found = FIXTURE_QUESTIONS.find((q) => q.id === id);
    return found ? { ...found } : null;
  }

  async getQuestionsForScope(params: {
    examId?: string;
    scope: PracticeScope;
    limit?: number;
  }): Promise<QuestionWithOptions[]> {
    const filtered = filterQuestionsByScope(FIXTURE_QUESTIONS, params.scope, params.examId);
    if (params.limit !== undefined && params.limit > 0) {
      return filtered.slice(0, params.limit);
    }
    return filtered;
  }

  async countQuestionsForScope(params: {
    examId?: string;
    scope: PracticeScope;
  }): Promise<number> {
    const filtered = filterQuestionsByScope(FIXTURE_QUESTIONS, params.scope, params.examId);
    return filtered.length;
  }

  async getAllQuestions(): Promise<QuestionWithOptions[]> {
    return [...FIXTURE_QUESTIONS];
  }
}

interface StoredQuestionSession {
  id: string;
  workspaceId: string;
  scopeType: QuestionSessionWithAttempts["scopeType"];
  scopeId: string;
  totalQuestions: number;
  status: QuestionSessionWithAttempts["status"];
  durationSeconds: number;
  startedAt: string | Date;
  completedAt: string | Date | null;
  questionIds: string[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface StoredQuestionAttempt {
  id: string;
  sessionId: string;
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  displayOrder: number;
  answeredAt: string | Date | null;
}

export class GuestQuestionSessionRepository implements QuestionSessionRepositoryInterface {
  constructor(
    private storage: StorageAdapter = appStorage,
    private questionRepo: QuestionRepositoryInterface,
    private practiceRepo: PracticeRepositoryInterface,
    private progressRepo: TopicProgressRepositoryInterface
  ) {}

  async createSession(input: CreateQuestionSessionInput): Promise<QuestionSessionWithAttempts> {
    const eligible = await this.questionRepo.getQuestionsForScope({
      scope: input.scope,
    });

    const selected = selectQuestionsForSession(eligible, input.questionCount, {
      seed: input.options?.seed,
      shuffle: input.options?.shuffle,
    });

    const sessionId = `q_sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();

    const scopeId =
      input.scope.type === "topic"
        ? input.scope.topicId
        : input.scope.type === "subject"
        ? input.scope.subjectId
        : input.scope.examAttemptId;

    const storedSession: StoredQuestionSession = {
      id: sessionId,
      workspaceId: input.workspaceId,
      scopeType: input.scope.type,
      scopeId,
      totalQuestions: selected.length,
      status: "in_progress",
      durationSeconds: 0,
      startedAt: now,
      completedAt: null,
      questionIds: selected.map((q) => q.id),
      createdAt: now,
      updatedAt: now,
    };

    const storedAttempts: StoredQuestionAttempt[] = selected.map((q, idx) => ({
      id: `q_att_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      sessionId,
      questionId: q.id,
      selectedOptionId: null,
      isCorrect: null,
      displayOrder: idx + 1,
      answeredAt: null,
    }));

    // Save session
    const sessions = (await this.storage.getItem<StoredQuestionSession[]>(GUEST_STORAGE_KEYS.QUESTION_SESSIONS)) || [];
    sessions.push(storedSession);
    await this.storage.setItem(GUEST_STORAGE_KEYS.QUESTION_SESSIONS, sessions);

    // Save attempts
    const attempts = (await this.storage.getItem<StoredQuestionAttempt[]>(GUEST_STORAGE_KEYS.QUESTION_ATTEMPTS)) || [];
    attempts.push(...storedAttempts);
    await this.storage.setItem(GUEST_STORAGE_KEYS.QUESTION_ATTEMPTS, attempts);

    return {
      ...storedSession,
      startedAt: now,
      completedAt: null,
      questions: selected,
      attempts: storedAttempts.map((a) => ({
        ...a,
        answeredAt: null,
      })),
    };
  }

  async getSession(sessionId: string, workspaceId: string): Promise<QuestionSessionWithAttempts | null> {
    const sessions = (await this.storage.getItem<StoredQuestionSession[]>(GUEST_STORAGE_KEYS.QUESTION_SESSIONS)) || [];
    const sess = sessions.find((s) => s.id === sessionId && s.workspaceId === workspaceId);
    if (!sess) return null;

    const attempts = (await this.storage.getItem<StoredQuestionAttempt[]>(GUEST_STORAGE_KEYS.QUESTION_ATTEMPTS)) || [];
    const sessionAttempts = attempts
      .filter((a) => a.sessionId === sessionId)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const questions: QuestionWithOptions[] = [];
    for (const qid of sess.questionIds) {
      const q = await this.questionRepo.getQuestionById(qid);
      if (q) questions.push(q);
    }

    return {
      id: sess.id,
      workspaceId: sess.workspaceId,
      scopeType: sess.scopeType,
      scopeId: sess.scopeId,
      totalQuestions: sess.totalQuestions,
      status: sess.status,
      durationSeconds: sess.durationSeconds,
      startedAt: new Date(sess.startedAt),
      completedAt: sess.completedAt ? new Date(sess.completedAt) : null,
      questions,
      attempts: sessionAttempts.map((a) => ({
        id: a.id,
        sessionId: a.sessionId,
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
        isCorrect: a.isCorrect,
        displayOrder: a.displayOrder,
        answeredAt: a.answeredAt ? new Date(a.answeredAt) : null,
      })),
    };
  }

  async recordAnswer(params: {
    sessionId: string;
    workspaceId: string;
    questionId: string;
    selectedOptionId: string | null;
  }): Promise<void> {
    const attempts = (await this.storage.getItem<StoredQuestionAttempt[]>(GUEST_STORAGE_KEYS.QUESTION_ATTEMPTS)) || [];
    const target = attempts.find(
      (a) => a.sessionId === params.sessionId && a.questionId === params.questionId
    );
    if (target) {
      target.selectedOptionId = params.selectedOptionId;
      target.answeredAt = params.selectedOptionId ? new Date() : null;
      await this.storage.setItem(GUEST_STORAGE_KEYS.QUESTION_ATTEMPTS, attempts);
    }
  }

  async submitSession(params: {
    sessionId: string;
    workspaceId: string;
    durationSeconds?: number;
    answers?: Record<string, string | null>;
  }): Promise<QuestionSessionResult> {
    const session = await this.getSession(params.sessionId, params.workspaceId);
    if (!session) {
      throw new Error("Question session not found");
    }

    const completedAt = new Date();
    const durationSeconds = params.durationSeconds ?? session.durationSeconds;

    // Collect effective answers
    const answersMap: Record<string, string | null> = {};
    for (const att of session.attempts) {
      answersMap[att.questionId] = att.selectedOptionId;
    }
    if (params.answers) {
      for (const [qid, optId] of Object.entries(params.answers)) {
        answersMap[qid] = optId;
      }
    }

    // Authoritative grading
    const result = gradeQuestionSession({
      sessionId: session.id,
      workspaceId: session.workspaceId,
      scopeType: session.scopeType,
      scopeId: session.scopeId,
      questions: session.questions,
      answers: answersMap,
      durationSeconds,
      completedAt,
      metadataResolver: (topicId) => getTopicMetadata(topicId),
    });

    // 1. Update stored attempts
    const attempts = (await this.storage.getItem<StoredQuestionAttempt[]>(GUEST_STORAGE_KEYS.QUESTION_ATTEMPTS)) || [];
    for (const item of result.questions) {
      const match = attempts.find((a) => a.sessionId === session.id && a.questionId === item.questionId);
      if (match) {
        match.selectedOptionId = item.selectedOptionId;
        match.isCorrect = item.isAttempted ? item.isCorrect : null;
        match.answeredAt = item.isAttempted ? completedAt : null;
      }
    }
    await this.storage.setItem(GUEST_STORAGE_KEYS.QUESTION_ATTEMPTS, attempts);

    // 2. Mark session completed
    const sessions = (await this.storage.getItem<StoredQuestionSession[]>(GUEST_STORAGE_KEYS.QUESTION_SESSIONS)) || [];
    const sessMatch = sessions.find((s) => s.id === session.id);
    if (sessMatch) {
      sessMatch.status = "completed";
      sessMatch.durationSeconds = durationSeconds;
      sessMatch.completedAt = completedAt;
      sessMatch.updatedAt = completedAt;
      await this.storage.setItem(GUEST_STORAGE_KEYS.QUESTION_SESSIONS, sessions);
    }

    // 3. Integrate with Phase 9 Practice Performance
    const questionsByTopic = new Map<
      string,
      { attempted: number; correct: number; incorrect: number }
    >();

    for (const q of result.questions) {
      const current = questionsByTopic.get(q.topicId) || { attempted: 0, correct: 0, incorrect: 0 };
      if (q.isAttempted) {
        current.attempted++;
        if (q.isCorrect) {
          current.correct++;
        } else {
          current.incorrect++;
        }
      }
      questionsByTopic.set(q.topicId, current);
    }

    for (const [topicId, stats] of questionsByTopic.entries()) {
      if (stats.attempted > 0) {
        const newPracSession = await this.practiceRepo.createPracticeSession({
          workspaceId: session.workspaceId,
          topicId,
          questionCount: stats.attempted,
          correct: stats.correct,
          incorrect: stats.incorrect,
          unattempted: 0,
          durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
          completedAt,
        });

        const [existingProgress, allSessions] = await Promise.all([
          this.progressRepo.getProgress(session.workspaceId, topicId),
          this.practiceRepo.getPracticeSessions(session.workspaceId),
        ]);

        const topicSessions = allSessions.filter((s) => s.topicId === topicId);
        if (!topicSessions.some((s) => s.id === newPracSession.id)) {
          topicSessions.push(newPracSession);
        }

        const progressPatch = applyPracticeSessionToProgress({
          workspaceId: session.workspaceId,
          topicId,
          existingProgress,
          sessions: topicSessions,
          completedAt,
        });

        await this.progressRepo.upsertProgress(progressPatch);
      }
    }

    return result;
  }

  async getRecentQuestionSessions(workspaceId: string): Promise<QuestionSessionWithAttempts[]> {
    const sessions = (await this.storage.getItem<StoredQuestionSession[]>(GUEST_STORAGE_KEYS.QUESTION_SESSIONS)) || [];
    const filtered = sessions
      .filter((s) => s.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const results: QuestionSessionWithAttempts[] = [];
    for (const s of filtered) {
      const sess = await this.getSession(s.id, workspaceId);
      if (sess) results.push(sess);
    }
    return results;
  }
}

export function createGuestRepositories(storage: StorageAdapter = appStorage, guestId: string = "guest_default"): DomainRepositories {
  const workspace = new GuestWorkspaceRepository(storage, guestId);
  const progress = new GuestTopicProgressRepository(storage);
  const planner = new GuestPlannerRepository(storage);
  const studySession = new GuestStudySessionRepository(storage);
  const revision = new GuestRevisionRepository(storage);
  const practice = new GuestPracticeRepository(storage);
  const resource = new GuestSavedResourceRepository(storage);
  const preferences = new GuestPreferencesRepository(storage, guestId);
  const question = new GuestQuestionRepository();
  const mock = new GuestMockTestRepository(storage, question, practice, progress);
  const questionSession = new GuestQuestionSessionRepository(storage, question, practice, progress);

  return {
    workspace,
    progress,
    planner,
    studySession,
    revision,
    practice,
    resource,
    mock,
    preferences,
    question,
    questionSession,
  };
}

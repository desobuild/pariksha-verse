import type { StorageAdapter } from "@/lib/storage/types";
import { appStorage } from "@/lib/storage";
import type {
  StudySessionCreateInput,
  TopicProgressUpsertInput,
} from "@/domain/study";
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
} from "./interfaces";
import type {
  UserWorkspace,
  NewUserWorkspace,
  UserTopicProgress,
  PlannerTask,
  NewPlannerTask,
  StudySession,
  RevisionItem,
  NewRevisionItem,
  PracticeSession,
  NewPracticeSession,
  SavedResource,
  NewSavedResource,
  MockTest,
  NewMockTest,
  MockTestResult,
  NewMockTestResult,
  UserPreferences,
  NewUserPreferences,
  NotificationPreferences,
  NewNotificationPreferences,
} from "@/db/schema";

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
  USER_PREFERENCES: "guest:user_preferences",
  NOTIFICATION_PREFERENCES: "guest:notification_preferences",
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

  async upsertRevisionItem(data: NewRevisionItem): Promise<RevisionItem> {
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
    return list.filter((p) => p.workspaceId === workspaceId);
  }

  async createPracticeSession(data: NewPracticeSession): Promise<PracticeSession> {
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

export class GuestMockTestRepository implements MockTestRepositoryInterface {
  constructor(private storage: StorageAdapter = appStorage) {}

  async getMockTests(workspaceId: string): Promise<MockTest[]> {
    const list = (await this.storage.getItem<MockTest[]>(GUEST_STORAGE_KEYS.MOCK_TESTS)) || [];
    return list.filter((m) => m.workspaceId === workspaceId);
  }

  async createMockTest(data: NewMockTest): Promise<MockTest> {
    const list = (await this.storage.getItem<MockTest[]>(GUEST_STORAGE_KEYS.MOCK_TESTS)) || [];
    const record: MockTest = {
      id: data.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      workspaceId: data.workspaceId,
      title: data.title,
      type: data.type,
      scheduledAt: data.scheduledAt ? (data.scheduledAt instanceof Date ? data.scheduledAt : new Date(data.scheduledAt)) : null,
      durationMinutes: data.durationMinutes,
      source: data.source ?? null,
      externalUrl: data.externalUrl ?? null,
      createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(),
      updatedAt: new Date(),
    };
    list.push(record);
    await this.storage.setItem(GUEST_STORAGE_KEYS.MOCK_TESTS, list);
    return record;
  }

  async saveResult(data: NewMockTestResult): Promise<MockTestResult> {
    const list = (await this.storage.getItem<MockTestResult[]>(GUEST_STORAGE_KEYS.MOCK_TEST_RESULTS)) || [];
    const existingIndex = list.findIndex((r) => r.mockTestId === data.mockTestId);
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
    };
    if (existingIndex >= 0) {
      list[existingIndex] = record;
    } else {
      list.push(record);
    }
    await this.storage.setItem(GUEST_STORAGE_KEYS.MOCK_TEST_RESULTS, list);
    return record;
  }

  async getResult(mockTestId: string): Promise<MockTestResult | null> {
    const list = (await this.storage.getItem<MockTestResult[]>(GUEST_STORAGE_KEYS.MOCK_TEST_RESULTS)) || [];
    return list.find((r) => r.mockTestId === mockTestId) || null;
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

export function createGuestRepositories(storage: StorageAdapter = appStorage, guestId: string = "guest_default"): DomainRepositories {
  return {
    workspace: new GuestWorkspaceRepository(storage, guestId),
    progress: new GuestTopicProgressRepository(storage),
    planner: new GuestPlannerRepository(storage),
    studySession: new GuestStudySessionRepository(storage),
    revision: new GuestRevisionRepository(storage),
    practice: new GuestPracticeRepository(storage),
    resource: new GuestSavedResourceRepository(storage),
    mock: new GuestMockTestRepository(storage),
    preferences: new GuestPreferencesRepository(storage, guestId),
  };
}

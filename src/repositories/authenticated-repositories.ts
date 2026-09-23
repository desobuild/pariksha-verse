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
  NewUserTopicProgress,
  PlannerTask,
  NewPlannerTask,
  StudySession,
  NewStudySession,
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

export class AuthenticatedWorkspaceRepository implements WorkspaceRepositoryInterface {
  async getWorkspaceById(id: string): Promise<UserWorkspace | null> {
    const list = await this.getWorkspaces();
    return list.find((w) => w.id === id) || null;
  }

  async getWorkspaces(): Promise<UserWorkspace[]> {
    const res = await fetch("/api/workspaces", { credentials: "include" });
    if (!res.ok) return [];
    const data = (await res.json()) as { workspaces?: UserWorkspace[] };
    return (data.workspaces || []).map((w: UserWorkspace) => ({
      ...w,
      startedAt: new Date(w.startedAt),
      createdAt: new Date(w.createdAt),
      updatedAt: new Date(w.updatedAt),
    }));
  }

  async getActiveWorkspace(): Promise<UserWorkspace | null> {
    const list = await this.getWorkspaces();
    return list.find((w) => w.isActive) || list[0] || null;
  }

  async getWorkspaceForAttempt(examAttemptId: string): Promise<UserWorkspace | null> {
    const list = await this.getWorkspaces();
    return list.find((w) => w.examAttemptId === examAttemptId) || null;
  }

  /**
   * Server-authoritative find-or-create: the API deduplicates by
   * (userId, examAttemptId) and activates the result.
   */
  async ensureWorkspaceForAttempt(examAttemptId: string): Promise<UserWorkspace> {
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examAttemptId, isActive: true, ensure: true }),
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Failed to create workspace on server");
    }
    const workspace = (await res.json()) as UserWorkspace;
    return {
      ...workspace,
      startedAt: new Date(workspace.startedAt),
      createdAt: new Date(workspace.createdAt),
      updatedAt: new Date(workspace.updatedAt),
    };
  }

  async createWorkspace(data: Omit<NewUserWorkspace, "userId">): Promise<UserWorkspace> {
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Failed to create workspace on server");
    }
    const created = (await res.json()) as UserWorkspace;
    return {
      ...created,
      startedAt: new Date(created.startedAt),
      createdAt: new Date(created.createdAt),
      updatedAt: new Date(created.updatedAt),
    };
  }

  async setActiveWorkspace(workspaceId: string): Promise<void> {
    await fetch(`/api/workspaces/${workspaceId}/active`, {
      method: "POST",
      credentials: "include",
    });
  }
}

export class AuthenticatedTopicProgressRepository implements TopicProgressRepositoryInterface {
  async getProgress(): Promise<UserTopicProgress | null> { return null; }
  async getAllProgressForWorkspace(): Promise<UserTopicProgress[]> { return []; }
  async upsertProgress(data: NewUserTopicProgress): Promise<UserTopicProgress> {
    return {
      id: data.id || "prog_temp",
      workspaceId: data.workspaceId,
      topicId: data.topicId,
      status: data.status ?? "not_started",
      startedAt: null,
      learnedAt: null,
      practicedAt: null,
      revisedAt: null,
      masteredAt: null,
      practiceAttempts: data.practiceAttempts ?? 0,
      correctAnswers: data.correctAnswers ?? 0,
      incorrectAnswers: data.incorrectAnswers ?? 0,
      accuracy: data.accuracy ?? 0,
      lastStudiedAt: null,
      lastRevisedAt: null,
      nextRevisionAt: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export class AuthenticatedPlannerRepository implements PlannerRepositoryInterface {
  async getTasksForWorkspace(): Promise<PlannerTask[]> { return []; }
  async createTask(data: NewPlannerTask): Promise<PlannerTask> {
    return {
      id: data.id || "task_temp",
      workspaceId: data.workspaceId,
      type: data.type,
      title: data.title,
      subjectId: null,
      chapterId: null,
      topicId: null,
      scheduledDate: data.scheduledDate,
      startTime: null,
      durationMinutes: data.durationMinutes,
      status: "upcoming",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async updateTaskStatus(): Promise<void> {}
  async deleteTask(): Promise<void> {}
}

export class AuthenticatedStudySessionRepository implements StudySessionRepositoryInterface {
  async getSessionsForWorkspace(): Promise<StudySession[]> { return []; }
  async createSession(data: NewStudySession): Promise<StudySession> {
    return {
      id: data.id || "sess_temp",
      workspaceId: data.workspaceId,
      plannerTaskId: null,
      topicId: null,
      durationMinutes: data.durationMinutes ?? 0,
      sessionType: "focused",
      startedAt: new Date(),
      endedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export class AuthenticatedRevisionRepository implements RevisionRepositoryInterface {
  async getRevisionItems(): Promise<RevisionItem[]> { return []; }
  async upsertRevisionItem(data: NewRevisionItem): Promise<RevisionItem> {
    return {
      id: data.id || "rev_temp",
      workspaceId: data.workspaceId,
      topicId: data.topicId,
      revisionNumber: 1,
      nextRevisionAt: null,
      lastRevisedAt: null,
      status: "scheduled",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export class AuthenticatedPracticeRepository implements PracticeRepositoryInterface {
  async getPracticeSessions(): Promise<PracticeSession[]> { return []; }
  async createPracticeSession(data: NewPracticeSession): Promise<PracticeSession> {
    return {
      id: data.id || "prac_temp",
      workspaceId: data.workspaceId,
      topicId: null,
      questionCount: 0,
      correct: 0,
      incorrect: 0,
      unattempted: 0,
      durationMinutes: 0,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export class AuthenticatedSavedResourceRepository implements SavedResourceRepositoryInterface {
  async getSavedResources(): Promise<SavedResource[]> { return []; }
  async saveResource(data: NewSavedResource): Promise<SavedResource> {
    return {
      id: data.id || "save_temp",
      workspaceId: data.workspaceId,
      resourceId: data.resourceId,
      savedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async removeSavedResource(): Promise<void> {}
}

export class AuthenticatedMockTestRepository implements MockTestRepositoryInterface {
  async getMockTests(): Promise<MockTest[]> { return []; }
  async createMockTest(data: NewMockTest): Promise<MockTest> {
    return {
      id: data.id || "mock_temp",
      workspaceId: data.workspaceId,
      title: data.title,
      type: data.type,
      scheduledAt: null,
      durationMinutes: data.durationMinutes,
      source: null,
      externalUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async saveResult(data: NewMockTestResult): Promise<MockTestResult> {
    return {
      id: data.id || "res_temp",
      mockTestId: data.mockTestId,
      score: data.score,
      totalMarks: data.totalMarks,
      correct: 0,
      incorrect: 0,
      unattempted: 0,
      accuracy: 0,
      notes: null,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async getResult(): Promise<MockTestResult | null> { return null; }
}

export class AuthenticatedPreferencesRepository implements PreferencesRepositoryInterface {
  async getUserPreferences(): Promise<UserPreferences | null> {
    try {
      const res = await fetch("/api/preferences", { credentials: "include" });
      if (!res.ok) return null;
      const data = (await res.json()) as { preferences?: UserPreferences | null };
      if (!data.preferences) return null;
      return {
        ...data.preferences,
        createdAt: new Date(data.preferences.createdAt),
        updatedAt: new Date(data.preferences.updatedAt),
      };
    } catch {
      return null;
    }
  }

  async saveUserPreferences(data: Partial<NewUserPreferences>): Promise<UserPreferences> {
    const res = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Failed to save preferences on server");
    }
    const saved = (await res.json()) as UserPreferences;
    return {
      ...saved,
      createdAt: new Date(saved.createdAt),
      updatedAt: new Date(saved.updatedAt),
    };
  }

  async getNotificationPreferences(): Promise<NotificationPreferences | null> { return null; }
  async saveNotificationPreferences(_data: Partial<NewNotificationPreferences>): Promise<NotificationPreferences> {
    return {
      userId: "auth_user",
      studyReminders: true,
      revisionReminders: true,
      mockTestReminders: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

export function createAuthenticatedRepositories(): DomainRepositories {
  return {
    workspace: new AuthenticatedWorkspaceRepository(),
    progress: new AuthenticatedTopicProgressRepository(),
    planner: new AuthenticatedPlannerRepository(),
    studySession: new AuthenticatedStudySessionRepository(),
    revision: new AuthenticatedRevisionRepository(),
    practice: new AuthenticatedPracticeRepository(),
    resource: new AuthenticatedSavedResourceRepository(),
    mock: new AuthenticatedMockTestRepository(),
    preferences: new AuthenticatedPreferencesRepository(),
  };
}

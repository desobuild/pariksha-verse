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
} from "./interfaces";
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
  private revive(row: UserTopicProgress): UserTopicProgress {
    return {
      ...row,
      startedAt: row.startedAt ? new Date(row.startedAt) : null,
      learnedAt: row.learnedAt ? new Date(row.learnedAt) : null,
      practicedAt: row.practicedAt ? new Date(row.practicedAt) : null,
      revisedAt: row.revisedAt ? new Date(row.revisedAt) : null,
      masteredAt: row.masteredAt ? new Date(row.masteredAt) : null,
      lastStudiedAt: row.lastStudiedAt ? new Date(row.lastStudiedAt) : null,
      lastRevisedAt: row.lastRevisedAt ? new Date(row.lastRevisedAt) : null,
      nextRevisionAt: row.nextRevisionAt ? new Date(row.nextRevisionAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async getProgress(workspaceId: string, topicId: string): Promise<UserTopicProgress | null> {
    const all = await this.getAllProgressForWorkspace(workspaceId);
    return all.find((p) => p.topicId === topicId) || null;
  }

  async getAllProgressForWorkspace(workspaceId: string): Promise<UserTopicProgress[]> {
    try {
      const res = await fetch(
        `/api/progress?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { progress?: UserTopicProgress[] };
      return (data.progress || []).map((p) => this.revive(p));
    } catch {
      return [];
    }
  }

  async upsertProgress(data: TopicProgressUpsertInput): Promise<UserTopicProgress> {
    const res = await fetch("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Failed to save topic progress on server");
    }
    return this.revive((await res.json()) as UserTopicProgress);
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
  private revive(row: StudySession): StudySession {
    return {
      ...row,
      startedAt: new Date(row.startedAt),
      endedAt: row.endedAt ? new Date(row.endedAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async getSessionsForWorkspace(workspaceId: string): Promise<StudySession[]> {
    try {
      const res = await fetch(
        `/api/study-sessions?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { sessions?: StudySession[] };
      return (data.sessions || []).map((s) => this.revive(s));
    } catch {
      return [];
    }
  }

  async createSession(data: StudySessionCreateInput): Promise<StudySession> {
    const res = await fetch("/api/study-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Failed to save study session on server");
    }
    return this.revive((await res.json()) as StudySession);
  }
}

export class AuthenticatedRevisionRepository implements RevisionRepositoryInterface {
  private revive(row: RevisionItem): RevisionItem {
    return {
      ...row,
      lastRevisedAt: row.lastRevisedAt ? new Date(row.lastRevisedAt) : null,
      nextRevisionAt: row.nextRevisionAt ? new Date(row.nextRevisionAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async getRevisionItems(workspaceId: string): Promise<RevisionItem[]> {
    try {
      const res = await fetch(
        `/api/revision?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { revisionItems?: RevisionItem[] };
      return (data.revisionItems || []).map((r) => this.revive(r));
    } catch {
      return [];
    }
  }

  async upsertRevisionItem(data: RevisionItemUpsertInput): Promise<RevisionItem> {
    const res = await fetch("/api/revision", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Failed to save revision item on server");
    }
    return this.revive((await res.json()) as RevisionItem);
  }
}

export class AuthenticatedPracticeRepository implements PracticeRepositoryInterface {
  private revive(row: PracticeSession): PracticeSession {
    return {
      ...row,
      completedAt: new Date(row.completedAt),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  async getPracticeSessions(workspaceId: string): Promise<PracticeSession[]> {
    try {
      const res = await fetch(
        `/api/practice?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { sessions?: PracticeSession[] };
      return (data.sessions || []).map((s) => this.revive(s));
    } catch {
      return [];
    }
  }

  async createPracticeSession(data: PracticeSessionCreateInput): Promise<PracticeSession> {
    const res = await fetch("/api/practice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Failed to save practice session on server");
    }
    return this.revive((await res.json()) as PracticeSession);
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

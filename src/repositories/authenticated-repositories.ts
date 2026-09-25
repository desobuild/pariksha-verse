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
import type {
  QuestionWithOptions,
  PracticeScope,
  CreateQuestionSessionInput,
  QuestionSessionWithAttempts,
  QuestionSessionResult,
} from "@/domain/practice-engine";
import type {
  MockTestDetail,
  MockTestSessionDetail,
  MockTestResultDetail,
} from "@/domain/mock-engine";
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
  private reviveMockTest(m: MockTestDetail): MockTestDetail {
    return {
      ...m,
      createdAt: new Date(m.createdAt),
      updatedAt: new Date(m.updatedAt),
      scheduledAt: m.scheduledAt ? new Date(m.scheduledAt) : null,
    };
  }

  private reviveSession(s: MockTestSessionDetail): MockTestSessionDetail {
    return {
      ...s,
      startedAt: new Date(s.startedAt),
      expiresAt: new Date(s.expiresAt),
      completedAt: s.completedAt ? new Date(s.completedAt) : null,
      mockTest: this.reviveMockTest(s.mockTest),
      questions: s.questions.map((q) => ({
        ...q,
        createdAt: new Date(q.createdAt),
        updatedAt: new Date(q.updatedAt),
      })),
    };
  }

  private reviveResult(r: MockTestResultDetail): MockTestResultDetail {
    return {
      ...r,
      completedAt: new Date(r.completedAt),
    };
  }

  async getMockTests(workspaceId: string): Promise<MockTestDetail[]> {
    try {
      const res = await fetch(`/api/mock-tests?workspaceId=${encodeURIComponent(workspaceId)}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const data = (await res.json()) as MockTestDetail[];
      return (data || []).map((m) => this.reviveMockTest(m));
    } catch {
      return [];
    }
  }

  async getMockTestById(id: string, workspaceId: string): Promise<MockTestDetail | null> {
    try {
      const res = await fetch(
        `/api/mock-tests/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: "include" }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as MockTestDetail;
      return this.reviveMockTest(data);
    } catch {
      return null;
    }
  }

  async createMockTest(data: NewMockTest): Promise<MockTestDetail> {
    const res = await fetch("/api/mock-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to create mock test");
    const created = (await res.json()) as MockTestDetail;
    return this.reviveMockTest(created);
  }

  async createSession(params: {
    workspaceId: string;
    mockTestId: string;
    seed?: number;
  }): Promise<MockTestSessionDetail> {
    const res = await fetch(`/api/mock-tests/${encodeURIComponent(params.mockTestId)}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || "Failed to create mock test session");
    }
    const session = (await res.json()) as MockTestSessionDetail;
    return this.reviveSession(session);
  }

  async getSession(sessionId: string, workspaceId: string): Promise<MockTestSessionDetail | null> {
    try {
      const res = await fetch(
        `/api/mock-tests/session/${encodeURIComponent(sessionId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: "include" }
      );
      if (!res.ok) return null;
      const session = (await res.json()) as MockTestSessionDetail;
      return this.reviveSession(session);
    } catch {
      return null;
    }
  }

  async updateSessionAnswer(params: {
    workspaceId: string;
    sessionId: string;
    questionId: string;
    selectedOptionId?: string | null;
    isMarkedForReview?: boolean;
    currentIndex?: number;
  }): Promise<void> {
    try {
      await fetch(`/api/mock-tests/session/${encodeURIComponent(params.sessionId)}/answer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        credentials: "include",
      });
    } catch {
      // Best-effort client sync
    }
  }

  async submitSession(params: {
    workspaceId: string;
    sessionId: string;
    submissionStatus?: "completed" | "auto_submitted";
    answers?: Record<string, string | null>;
    markedForReview?: string[];
    completedAt?: Date;
  }): Promise<MockTestResultDetail> {
    const res = await fetch(`/api/mock-tests/session/${encodeURIComponent(params.sessionId)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || "Failed to submit mock test");
    }
    const result = (await res.json()) as MockTestResultDetail;
    return this.reviveResult(result);
  }

  async saveResult(data: NewMockTestResult): Promise<MockTestResult> {
    return {
      id: data.id || "res_temp",
      mockTestId: data.mockTestId,
      score: data.score,
      totalMarks: data.totalMarks,
      correct: data.correct ?? 0,
      incorrect: data.incorrect ?? 0,
      unattempted: data.unattempted ?? 0,
      accuracy: data.accuracy ?? 0,
      notes: null,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      sessionId: data.sessionId ?? null,
      timeSpentSeconds: data.timeSpentSeconds ?? 0,
      submissionStatus: data.submissionStatus ?? "completed",
      sectionResults: data.sectionResults ?? null,
      questionResults: data.questionResults ?? null,
    };
  }

  async getResult(mockTestId: string, workspaceId?: string): Promise<MockTestResultDetail | null> {
    try {
      const url = workspaceId
        ? `/api/mock-tests/${encodeURIComponent(mockTestId)}/result?workspaceId=${encodeURIComponent(workspaceId)}`
        : `/api/mock-tests/${encodeURIComponent(mockTestId)}/result`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return null;
      const data = (await res.json()) as MockTestResultDetail;
      return this.reviveResult(data);
    } catch {
      return null;
    }
  }

  async getResultBySessionId(sessionId: string, workspaceId: string): Promise<MockTestResultDetail | null> {
    try {
      const res = await fetch(
        `/api/mock-tests/session/${encodeURIComponent(sessionId)}/result?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: "include" }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as MockTestResultDetail;
      return this.reviveResult(data);
    } catch {
      return null;
    }
  }

  async getAllResultsForWorkspace(workspaceId: string): Promise<MockTestResultDetail[]> {
    try {
      const res = await fetch(`/api/mock-tests/results?workspaceId=${encodeURIComponent(workspaceId)}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const data = (await res.json()) as MockTestResultDetail[];
      return (data || []).map((r) => this.reviveResult(r));
    } catch {
      return [];
    }
  }
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

export class AuthenticatedQuestionRepository implements QuestionRepositoryInterface {
  private reviveQuestion(q: QuestionWithOptions): QuestionWithOptions {
    return {
      ...q,
      createdAt: new Date(q.createdAt),
      updatedAt: new Date(q.updatedAt),
    };
  }

  async getQuestionById(id: string): Promise<QuestionWithOptions | null> {
    try {
      const res = await fetch(`/api/questions/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as QuestionWithOptions;
      return this.reviveQuestion(data);
    } catch {
      return null;
    }
  }

  async getQuestionsForScope(params: {
    examId?: string;
    scope: PracticeScope;
    limit?: number;
  }): Promise<QuestionWithOptions[]> {
    try {
      const scopeId =
        params.scope.type === "topic"
          ? params.scope.topicId
          : params.scope.type === "subject"
          ? params.scope.subjectId
          : params.scope.examAttemptId;

      const url = new URL("/api/questions", window.location.origin);
      url.searchParams.set("scopeType", params.scope.type);
      url.searchParams.set("scopeId", scopeId);
      if (params.examId) url.searchParams.set("examId", params.examId);
      if (params.limit) url.searchParams.set("limit", String(params.limit));

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) return [];
      const data = (await res.json()) as { questions?: QuestionWithOptions[] };
      return (data.questions || []).map((q) => this.reviveQuestion(q));
    } catch {
      return [];
    }
  }

  async countQuestionsForScope(params: {
    examId?: string;
    scope: PracticeScope;
  }): Promise<number> {
    const list = await this.getQuestionsForScope(params);
    return list.length;
  }

  async getAllQuestions(): Promise<QuestionWithOptions[]> {
    try {
      const res = await fetch("/api/questions", { credentials: "include" });
      if (!res.ok) return [];
      const data = (await res.json()) as { questions?: QuestionWithOptions[] };
      return (data.questions || []).map((q) => this.reviveQuestion(q));
    } catch {
      return [];
    }
  }
}

export class AuthenticatedQuestionSessionRepository implements QuestionSessionRepositoryInterface {
  private reviveSession(s: QuestionSessionWithAttempts): QuestionSessionWithAttempts {
    return {
      ...s,
      startedAt: new Date(s.startedAt),
      completedAt: s.completedAt ? new Date(s.completedAt) : null,
      questions: (s.questions || []).map((q) => ({
        ...q,
        createdAt: new Date(q.createdAt),
        updatedAt: new Date(q.updatedAt),
      })),
      attempts: (s.attempts || []).map((a) => ({
        ...a,
        answeredAt: a.answeredAt ? new Date(a.answeredAt) : null,
      })),
    };
  }

  async createSession(data: CreateQuestionSessionInput): Promise<QuestionSessionWithAttempts> {
    const res = await fetch("/api/practice/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Failed to create practice session on server");
    }
    const session = (await res.json()) as QuestionSessionWithAttempts;
    return this.reviveSession(session);
  }

  async getSession(sessionId: string, workspaceId: string): Promise<QuestionSessionWithAttempts | null> {
    try {
      const res = await fetch(
        `/api/practice/session/${encodeURIComponent(sessionId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: "include" }
      );
      if (!res.ok) return null;
      const session = (await res.json()) as QuestionSessionWithAttempts;
      return this.reviveSession(session);
    } catch {
      return null;
    }
  }

  async recordAnswer(params: {
    sessionId: string;
    workspaceId: string;
    questionId: string;
    selectedOptionId: string | null;
  }): Promise<void> {
    const res = await fetch(`/api/practice/session/${encodeURIComponent(params.sessionId)}/answer`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Failed to record answer on server");
    }
  }

  async submitSession(params: {
    sessionId: string;
    workspaceId: string;
    durationSeconds?: number;
    answers?: Record<string, string | null>;
  }): Promise<QuestionSessionResult> {
    const res = await fetch(`/api/practice/session/${encodeURIComponent(params.sessionId)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Failed to submit question session on server");
    }
    const result = (await res.json()) as QuestionSessionResult;
    return {
      ...result,
      completedAt: new Date(result.completedAt),
    };
  }

  async getRecentQuestionSessions(workspaceId: string): Promise<QuestionSessionWithAttempts[]> {
    try {
      const res = await fetch(
        `/api/practice/session?workspaceId=${encodeURIComponent(workspaceId)}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      const data = (await res.json()) as { sessions?: QuestionSessionWithAttempts[] };
      return (data.sessions || []).map((s) => this.reviveSession(s));
    } catch {
      return [];
    }
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
    question: new AuthenticatedQuestionRepository(),
    questionSession: new AuthenticatedQuestionSessionRepository(),
  };
}

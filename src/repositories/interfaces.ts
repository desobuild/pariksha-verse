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
import type { StudySessionCreateInput, TopicProgressUpsertInput } from "@/domain/study";
import type { RevisionItemUpsertInput } from "@/domain/revision";
import type { PracticeSessionCreateInput } from "@/domain/practice";
import type {
  QuestionWithOptions,
  PracticeScope,
  CreateQuestionSessionInput,
  QuestionSessionWithAttempts,
  QuestionSessionResult,
} from "@/domain/practice-engine";

export interface WorkspaceRepositoryInterface {
  getWorkspaceById(id: string): Promise<UserWorkspace | null>;
  getWorkspaces(): Promise<UserWorkspace[]>;
  getActiveWorkspace(): Promise<UserWorkspace | null>;
  /** Finds the workspace bound to a specific exam attempt, if any. */
  getWorkspaceForAttempt(examAttemptId: string): Promise<UserWorkspace | null>;
  createWorkspace(
    data: Omit<NewUserWorkspace, "userId" | "id"> & { id?: string; userId?: string }
  ): Promise<UserWorkspace>;
  /**
   * Deterministic find-or-create for an exam attempt (Phase 5 onboarding).
   * Reuses any existing workspace for the attempt instead of duplicating it,
   * and establishes the result as the active workspace.
   */
  ensureWorkspaceForAttempt(examAttemptId: string): Promise<UserWorkspace>;
  setActiveWorkspace(workspaceId: string): Promise<void>;
}

export interface TopicProgressRepositoryInterface {
  getProgress(workspaceId: string, topicId: string): Promise<UserTopicProgress | null>;
  getAllProgressForWorkspace(workspaceId: string): Promise<UserTopicProgress[]>;
  upsertProgress(data: TopicProgressUpsertInput): Promise<UserTopicProgress>;
}

export interface PlannerRepositoryInterface {
  getTasksForWorkspace(workspaceId: string): Promise<PlannerTask[]>;
  createTask(data: NewPlannerTask): Promise<PlannerTask>;
  updateTaskStatus(taskId: string, status: PlannerTask["status"]): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
}

export interface StudySessionRepositoryInterface {
  getSessionsForWorkspace(workspaceId: string): Promise<StudySession[]>;
  createSession(data: StudySessionCreateInput): Promise<StudySession>;
}

export interface RevisionRepositoryInterface {
  getRevisionItems(workspaceId: string): Promise<RevisionItem[]>;
  upsertRevisionItem(data: RevisionItemUpsertInput): Promise<RevisionItem>;
}

export interface PracticeRepositoryInterface {
  getPracticeSessions(workspaceId: string): Promise<PracticeSession[]>;
  createPracticeSession(data: PracticeSessionCreateInput): Promise<PracticeSession>;
}

export interface SavedResourceRepositoryInterface {
  getSavedResources(workspaceId: string): Promise<SavedResource[]>;
  saveResource(data: NewSavedResource): Promise<SavedResource>;
  removeSavedResource(workspaceId: string, resourceId: string): Promise<void>;
}

import type {
  MockTestDetail,
  MockTestSessionDetail,
  MockTestResultDetail,
} from "@/domain/mock-engine";

export interface MockTestRepositoryInterface {
  getMockTests(workspaceId: string): Promise<MockTestDetail[]>;
  getMockTestById(id: string, workspaceId: string): Promise<MockTestDetail | null>;
  createMockTest(data: NewMockTest): Promise<MockTestDetail>;
  createSession(params: {
    workspaceId: string;
    mockTestId: string;
    seed?: number;
  }): Promise<MockTestSessionDetail>;
  getSession(sessionId: string, workspaceId: string): Promise<MockTestSessionDetail | null>;
  updateSessionAnswer(params: {
    workspaceId: string;
    sessionId: string;
    questionId: string;
    selectedOptionId?: string | null;
    isMarkedForReview?: boolean;
    currentIndex?: number;
  }): Promise<void>;
  submitSession(params: {
    workspaceId: string;
    sessionId: string;
    submissionStatus?: "completed" | "auto_submitted";
    answers?: Record<string, string | null>;
    markedForReview?: string[];
    completedAt?: Date;
  }): Promise<MockTestResultDetail>;
  saveResult(data: NewMockTestResult): Promise<MockTestResult>;
  getResult(mockTestId: string, workspaceId?: string): Promise<MockTestResultDetail | null>;
  getResultBySessionId(sessionId: string, workspaceId: string): Promise<MockTestResultDetail | null>;
  getAllResultsForWorkspace(workspaceId: string): Promise<MockTestResultDetail[]>;
}

export interface PreferencesRepositoryInterface {
  getUserPreferences(): Promise<UserPreferences | null>;
  saveUserPreferences(data: Partial<NewUserPreferences>): Promise<UserPreferences>;
  getNotificationPreferences(): Promise<NotificationPreferences | null>;
  saveNotificationPreferences(data: Partial<NewNotificationPreferences>): Promise<NotificationPreferences>;
}

export interface QuestionRepositoryInterface {
  getQuestionById(id: string): Promise<QuestionWithOptions | null>;
  getQuestionsForScope(params: {
    examId?: string;
    scope: PracticeScope;
    limit?: number;
  }): Promise<QuestionWithOptions[]>;
  countQuestionsForScope(params: {
    examId?: string;
    scope: PracticeScope;
  }): Promise<number>;
  getAllQuestions(): Promise<QuestionWithOptions[]>;
}

export interface QuestionSessionRepositoryInterface {
  createSession(data: CreateQuestionSessionInput): Promise<QuestionSessionWithAttempts>;
  getSession(sessionId: string, workspaceId: string): Promise<QuestionSessionWithAttempts | null>;
  recordAnswer(params: {
    sessionId: string;
    workspaceId: string;
    questionId: string;
    selectedOptionId: string | null;
  }): Promise<void>;
  submitSession(params: {
    sessionId: string;
    workspaceId: string;
    durationSeconds?: number;
    answers?: Record<string, string | null>;
  }): Promise<QuestionSessionResult>;
  getRecentQuestionSessions(workspaceId: string): Promise<QuestionSessionWithAttempts[]>;
}

export interface DomainRepositories {
  workspace: WorkspaceRepositoryInterface;
  progress: TopicProgressRepositoryInterface;
  planner: PlannerRepositoryInterface;
  studySession: StudySessionRepositoryInterface;
  revision: RevisionRepositoryInterface;
  practice: PracticeRepositoryInterface;
  resource: SavedResourceRepositoryInterface;
  mock: MockTestRepositoryInterface;
  preferences: PreferencesRepositoryInterface;
  question: QuestionRepositoryInterface;
  questionSession: QuestionSessionRepositoryInterface;
}

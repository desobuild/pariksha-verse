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
import type { StudySessionCreateInput, TopicProgressUpsertInput } from "@/domain/study";
import type { RevisionItemUpsertInput } from "@/domain/revision";
import type { PracticeSessionCreateInput } from "@/domain/practice";

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

export interface MockTestRepositoryInterface {
  getMockTests(workspaceId: string): Promise<MockTest[]>;
  createMockTest(data: NewMockTest): Promise<MockTest>;
  saveResult(data: NewMockTestResult): Promise<MockTestResult>;
  getResult(mockTestId: string): Promise<MockTestResult | null>;
}

export interface PreferencesRepositoryInterface {
  getUserPreferences(): Promise<UserPreferences | null>;
  saveUserPreferences(data: Partial<NewUserPreferences>): Promise<UserPreferences>;
  getNotificationPreferences(): Promise<NotificationPreferences | null>;
  saveNotificationPreferences(data: Partial<NewNotificationPreferences>): Promise<NotificationPreferences>;
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
}

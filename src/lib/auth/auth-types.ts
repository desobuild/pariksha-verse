import type {
  UserWorkspace,
  UserTopicProgress,
  PlannerTask,
  StudySession,
  RevisionItem,
  PracticeSession,
  SavedResource,
  MockTest,
  MockTestResult,
  UserPreferences,
  NotificationPreferences,
} from "@/db/schema";

export interface GuestIdentity {
  id: string;
  createdAt: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  createdAt: number;
  updatedAt?: number;
}

export interface AuthSession {
  user: AuthenticatedUser;
  expiresAt: number;
}

export type AuthStatus = "loading" | "guest" | "authenticated" | "unauthenticated" | "error";

export interface AuthIdentity {
  type: "guest" | "authenticated";
  id: string;
  guest?: GuestIdentity;
  user?: AuthenticatedUser;
}

/**
 * Public-safe description of one staging demo profile. Contains only the
 * slot key and display label — never user IDs, emails, or auth internals.
 */
export interface DemoAuthOption {
  slot: string;
  label: string;
}

/**
 * Server-decided availability of staging demo authentication. The client can
 * only render what the server reports; it can never enable the feature.
 */
export interface DemoAuthConfig {
  enabled: boolean;
  options: DemoAuthOption[];
}

export interface GuestMigrationState {
  status: "idle" | "pending" | "in_progress" | "completed" | "failed";
  authenticatedUserId: string | null;
  startedAt: number | null;
  completedAt: number | null;
  error?: string;
}

export interface GuestMigrationPayload {
  guestId: string;
  workspaces?: Partial<UserWorkspace>[];
  topicProgress?: Partial<UserTopicProgress>[];
  plannerTasks?: Partial<PlannerTask>[];
  studySessions?: Partial<StudySession>[];
  revisionItems?: Partial<RevisionItem>[];
  practiceSessions?: Partial<PracticeSession>[];
  savedResources?: Partial<SavedResource>[];
  mockTests?: Partial<MockTest>[];
  mockTestResults?: Partial<MockTestResult>[];
  preferences?: Partial<UserPreferences>;
  notificationPreferences?: Partial<NotificationPreferences>;
}

export interface MigrationSummary {
  workspacesMigrated: number;
  topicProgressMigrated: number;
  plannerTasksMigrated: number;
  studySessionsMigrated: number;
  revisionItemsMigrated: number;
  practiceSessionsMigrated: number;
  savedResourcesMigrated: number;
  mockTestsMigrated: number;
  mockTestResultsMigrated: number;
}

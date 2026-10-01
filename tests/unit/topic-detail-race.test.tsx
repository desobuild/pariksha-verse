import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import { TopicDetailView } from "@/components/study/topic-detail-view";
import { createGuestRepositories } from "@/repositories/guest-repositories";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage";
import type { DomainRepositories } from "@/repositories/interfaces";
import type { TopicProgressUpsertInput } from "@/domain/study";
import type {
  StudySession,
  UserTopicProgress,
  UserWorkspace,
} from "@/db/schema";

/**
 * Phase 14B — Study-session stale-write race regression (PART C).
 *
 * The topic detail view has two concurrent progress writers:
 *   1. user status changes ("Mark Learned"),
 *   2. the fire-and-forget study-session refresh (lastStudiedAt upsert).
 *
 * The progress PUT is a FULL-RECORD upsert, so a refresh that read a
 * pre-session snapshot and lands after "Mark Learned" reverts the topic to
 * NOT_STARTED. These tests reproduce that interleaving with deferred
 * repository promises and assert the deterministic fix: every progress
 * read-modify-write runs inside one FIFO queue turn, so the last write is
 * always the newer action and a stale snapshot is never written.
 *
 * The same component code serves guest (IndexedDB) and authenticated (D1)
 * users through the repository interface; the guest flow is additionally
 * exercised against the real guest repository.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

// StatusControl is a Radix dropdown (not scriptable in jsdom); the race under
// test lives in TopicDetailView's queue, so substitute a plain button that
// invokes the same onChange("learned") path. TopicStatusBadge stays real.
vi.mock("@/components/study/topic-status", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/study/topic-status")>();
  return {
    ...actual,
    StatusControl: ({ onChange }: { onChange: (status: string) => void }) => (
      <button type="button" onClick={() => onChange("learned")}>
        mark-learned-test
      </button>
    ),
  };
});

const mockUseRepositories = vi.fn();
vi.mock("@/repositories/repository-provider", () => ({
  useRepositories: () => mockUseRepositories(),
}));

const mockUseActiveWorkspace = vi.fn();
vi.mock("@/hooks/use-active-workspace", () => ({
  useActiveWorkspace: () => mockUseActiveWorkspace(),
}));

const WORKSPACE_ID = "ws_race";
const ATTEMPT_ID = "attempt_neet_2027";
const TOPIC_ID = "exam_neet_physics_physics-and-measurement_units-and-measurements";

const workspace = {
  id: WORKSPACE_ID,
  userId: "usr_race",
  examAttemptId: ATTEMPT_ID,
  isActive: true,
  startedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as UserWorkspace;

function progressRow(overrides: Partial<UserTopicProgress> = {}): UserTopicProgress {
  const now = new Date();
  return {
    id: `prog_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: WORKSPACE_ID,
    topicId: TOPIC_ID,
    status: "not_started",
    startedAt: null,
    learnedAt: null,
    practicedAt: null,
    revisedAt: null,
    masteredAt: null,
    practiceAttempts: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    accuracy: 0,
    lastStudiedAt: null,
    lastRevisedAt: null,
    nextRevisionAt: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Applies an upsert payload onto the "server" row, as D1/IndexedDB would. */
function applyUpsert(existing: UserTopicProgress | null, data: TopicProgressUpsertInput): UserTopicProgress {
  return {
    id: existing?.id ?? data.id ?? `prog_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: data.workspaceId,
    topicId: data.topicId,
    status: data.status ?? "not_started",
    startedAt: data.startedAt ?? null,
    learnedAt: data.learnedAt ?? null,
    practicedAt: data.practicedAt ?? null,
    revisedAt: data.revisedAt ?? null,
    masteredAt: data.masteredAt ?? null,
    practiceAttempts: data.practiceAttempts ?? 0,
    correctAnswers: data.correctAnswers ?? 0,
    incorrectAnswers: data.incorrectAnswers ?? 0,
    accuracy: data.accuracy ?? 0,
    lastStudiedAt: data.lastStudiedAt ?? null,
    lastRevisedAt: data.lastRevisedAt ?? null,
    nextRevisionAt: data.nextRevisionAt ?? null,
    notes: data.notes ?? null,
    createdAt: data.createdAt ?? existing?.createdAt ?? new Date(),
    updatedAt: new Date(),
  };
}

function sessionRow(): StudySession {
  const now = new Date();
  return {
    id: `sess_${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: WORKSPACE_ID,
    plannerTaskId: null,
    topicId: TOPIC_ID,
    startedAt: new Date(now.getTime() - 15 * 60000),
    endedAt: now,
    durationMinutes: 15,
    sessionType: "focused",
    createdAt: now,
    updatedAt: now,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface RepoHarness {
  repos: DomainRepositories;
  upsertCalls: TopicProgressUpsertInput[];
  /** What the "server" holds right now; getProgress (ungated) returns it. */
  serverRow: UserTopicProgress | null;
  /** Gates the FIRST getProgress call (the background refresh's read). */
  firstGetProgressGate: { promise: Promise<UserTopicProgress | null> } | null;
  failNextGetProgress: boolean;
}

function createDeferredRepoHarness(initialServerRow: UserTopicProgress | null): RepoHarness {
  const harness: RepoHarness = {
    repos: {} as DomainRepositories,
    upsertCalls: [],
    serverRow: initialServerRow,
    firstGetProgressGate: null,
    failNextGetProgress: false,
  };

  const progress = {
    getProgress: vi.fn(async () => {
      if (harness.firstGetProgressGate) {
        const gate = harness.firstGetProgressGate;
        harness.firstGetProgressGate = null;
        return gate.promise;
      }
      if (harness.failNextGetProgress) {
        harness.failNextGetProgress = false;
        throw new Error("simulated read failure");
      }
      return harness.serverRow;
    }),
    getAllProgressForWorkspace: vi.fn(async () =>
      harness.serverRow ? [harness.serverRow] : []
    ),
    upsertProgress: vi.fn(async (data: TopicProgressUpsertInput) => {
      harness.upsertCalls.push(data);
      harness.serverRow = applyUpsert(harness.serverRow, data);
      return harness.serverRow;
    }),
  };

  harness.repos = {
    progress,
    studySession: {
      getSessionsForWorkspace: vi.fn(async () => []),
      createSession: vi.fn(async () => sessionRow()),
    },
    revision: {
      getRevisionItems: vi.fn(async () => []),
      upsertRevisionItem: vi.fn(async (data) => ({
        id: data.id ?? `rev_${Math.random().toString(36).slice(2, 8)}`,
        workspaceId: data.workspaceId,
        topicId: data.topicId,
        revisionNumber: data.revisionNumber ?? 1,
        lastRevisedAt: data.lastRevisedAt ?? new Date(),
        nextRevisionAt: data.nextRevisionAt ?? new Date(),
        status: data.status ?? "scheduled",
        createdAt: data.createdAt ?? new Date(),
      })),
    },
    practice: {
      getPracticeSessions: vi.fn(async () => []),
    },
  } as unknown as DomainRepositories;

  return harness;
}

async function renderTopicDetail(repos: DomainRepositories) {
  mockUseRepositories.mockReturnValue(repos);
  mockUseActiveWorkspace.mockReturnValue({
    workspace,
    status: "ready",
    refresh: async () => {},
  });
  render(<TopicDetailView topicId={TOPIC_ID} />);
  // Wait for the initial page load to settle.
  await waitFor(() => {
    expect(screen.getByText("Study Progress")).toBeVisible();
  });
}

async function recordManualSession() {
  fireEvent.click(screen.getByRole("button", { name: /log time manually/i }));
  const duration = await screen.findByRole("spinbutton", { name: /duration in minutes/i });
  fireEvent.change(duration, { target: { value: "15" } });
  fireEvent.click(screen.getByRole("button", { name: /save session/i }));
}

function markLearned() {
  fireEvent.click(screen.getByRole("button", { name: "mark-learned-test" }));
}

describe("Phase 14B — study-session stale-write race (topic detail)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a stale in-flight session refresh cannot revert a newer Mark Learned", async () => {
    // Server starts with NOT_STARTED; the UI loads that row.
    const staleRow = progressRow({ status: "not_started" });
    const harness = createDeferredRepoHarness(staleRow);
    // Gate the background refresh's read so it is still in flight when the
    // user presses Mark Learned — exactly the reported race window.
    const gate = deferred<UserTopicProgress | null>();
    harness.firstGetProgressGate = { promise: gate.promise };

    await renderTopicDetail(harness.repos);

    // 1. User records a study session → background refresh enqueued; its
    //    getProgress hangs on the gate.
    await recordManualSession();
    await waitFor(() => {
      expect(harness.repos.progress.getProgress).toHaveBeenCalledTimes(1);
    });

    // 2. User presses Mark Learned while the refresh read is still pending.
    markLearned();

    // 3. The refresh's read resolves with the STALE pre-session snapshot and
    //    its full-record upsert lands.
    await act(async () => {
      gate.resolve(staleRow);
    });
    await waitFor(() => {
      expect(harness.upsertCalls.length).toBeGreaterThanOrEqual(1);
    });
    // 4. The queued status change runs afterwards and must win.
    await waitFor(() => {
      expect(harness.upsertCalls.length).toBe(2);
    });
    await waitFor(() => {
      expect(screen.getAllByText("Learned").length).toBeGreaterThan(0);
    });

    // The last write on the repository is the user's LEARNED status, carrying
    // the refreshed lastStudiedAt (no legitimate update lost), and the UI
    // reflects it.
    const backgroundWrite = harness.upsertCalls[0];
    const userWrite = harness.upsertCalls[1];
    expect(backgroundWrite.status).toBe("not_started");
    expect(backgroundWrite.lastStudiedAt).not.toBeNull();
    expect(userWrite.status).toBe("learned");
    expect(userWrite.lastStudiedAt).not.toBeNull();
    expect(harness.serverRow?.status).toBe("learned");
    expect(harness.serverRow?.lastStudiedAt).not.toBeNull();
  });

  it("a session refresh completing after a status change preserves the learned status", async () => {
    const harness = createDeferredRepoHarness(null);
    await renderTopicDetail(harness.repos);

    markLearned();
    await waitFor(() => {
      expect(harness.upsertCalls.length).toBe(1);
      expect(harness.upsertCalls[0].status).toBe("learned");
    });

    // Session recorded afterwards: the refresh re-reads persisted state,
    // which now says LEARNED, and must keep it.
    await recordManualSession();
    await waitFor(() => {
      expect(harness.upsertCalls.length).toBe(2);
    });
    expect(harness.upsertCalls[1].status).toBe("learned");
    expect(harness.upsertCalls[1].lastStudiedAt).not.toBeNull();
    expect(harness.serverRow?.status).toBe("learned");
    await waitFor(() => {
      expect(screen.getAllByText("Learned").length).toBeGreaterThan(0);
    });
  });

  it("skips the background refresh write when the fresh read fails instead of writing a stale snapshot", async () => {
    const harness = createDeferredRepoHarness(null);
    await renderTopicDetail(harness.repos);

    markLearned();
    await waitFor(() => {
      expect(harness.upsertCalls.length).toBe(1);
    });

    harness.failNextGetProgress = true;
    await recordManualSession();
    await waitFor(() => {
      expect(harness.repos.progress.getProgress).toHaveBeenCalledTimes(2);
    });

    // The failed read must not fall back to a page-load snapshot and write it.
    await act(async () => {});
    expect(harness.upsertCalls.length).toBe(1);
    expect(harness.serverRow?.status).toBe("learned");
    expect(screen.getAllByText("Learned").length).toBeGreaterThan(0);
  });

  it("a status change re-reads persisted state so the background lastStudiedAt is not lost", async () => {
    const harness = createDeferredRepoHarness(null);
    await renderTopicDetail(harness.repos);

    // Session refresh completes first: lastStudiedAt is written server-side.
    await recordManualSession();
    await waitFor(() => {
      expect(harness.upsertCalls.length).toBe(1);
      expect(harness.upsertCalls[0].status).toBe("not_started");
    });
    const refreshedLastStudiedAt = harness.serverRow?.lastStudiedAt;
    expect(refreshedLastStudiedAt).not.toBeNull();

    // The user then marks learned: the write must be applied on top of the
    // refreshed row, keeping lastStudiedAt.
    markLearned();
    await waitFor(() => {
      expect(harness.upsertCalls.length).toBe(2);
    });
    expect(harness.upsertCalls[1].status).toBe("learned");
    expect(harness.upsertCalls[1].lastStudiedAt).not.toBeNull();
    expect(harness.serverRow?.status).toBe("learned");
    expect(harness.serverRow?.lastStudiedAt).not.toBeNull();
  });

  it("guest (IndexedDB) flow: Mark Learned persists and a recorded session does not revert it", async () => {
    // Real guest repository over in-memory storage — the same code path local
    // guests use (IndexedDB adapter swapped for the memory adapter).
    const storage = new MemoryStorageAdapter();
    const repos = createGuestRepositories(storage as never, "guest_race");
    mockUseRepositories.mockReturnValue(repos);
    mockUseActiveWorkspace.mockReturnValue({
      workspace,
      status: "ready",
      refresh: async () => {},
    });

    render(<TopicDetailView topicId={TOPIC_ID} />);
    await waitFor(() => {
      expect(screen.getByText("Study Progress")).toBeVisible();
    });

    markLearned();
    await waitFor(() => {
      expect(screen.getAllByText("Learned").length).toBeGreaterThan(0);
    });

    await recordManualSession();

    // Give the fire-and-forget refresh time to land, then verify the status
    // stays LEARNED and lastStudiedAt was refreshed.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getAllByText("Learned").length).toBeGreaterThan(0);

    const stored =
      (await storage.getItem<UserTopicProgress[]>("guest:topic_progress")) ?? [];
    const row = stored.find((p) => p.workspaceId === WORKSPACE_ID && p.topicId === TOPIC_ID);
    expect(row?.status).toBe("learned");
    expect(row?.lastStudiedAt).not.toBeNull();
  });
});

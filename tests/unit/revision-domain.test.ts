import { describe, it, expect } from "vitest";
import {
  REVISION_INTERVALS_DAYS,
  addLocalDays,
  applyRevisionCompletion,
  calculateNextRevisionDate,
  classifyRevision,
  diffLocalDays,
  endOfLocalDay,
  filterRevisionQueue,
  getRevisionIntervalDays,
  getRevisionQueue,
  isRevisionDue,
  isRevisionEligible,
  isRevisionOverdue,
  resolveCompletedRevisionNumber,
  scheduleFirstRevisionDate,
  scheduleRevisionForStatusChange,
  startOfLocalDay,
  toDate,
} from "@/domain/revision";
import { applyTopicStatusChange } from "@/domain/study";
import type { RevisionItem, UserTopicProgress } from "@/db/schema";
import type { TopicStatus } from "@/domain/study";

// Local-time anchors keep every assertion timezone-independent.
const REF = new Date(2026, 8, 24, 12, 0, 0); // Sep 24 2026, local noon
const AT = new Date(2026, 8, 24, 21, 30, 0); // Sep 24 2026, local evening

// Canonical NEET taxonomy topics (real IDs, canonical subject order P → C → B).
const T_PHYSICS_1 = "exam_neet_physics_physics-and-measurement_units-and-measurements";
const T_PHYSICS_2 = "exam_neet_physics_kinematics_motion-in-straight-line";
const T_PHYSICS_3 = "exam_neet_physics_kinematics_vectors-and-scalars";
const T_CHEM_1 = "exam_neet_chemistry_basic-concepts-of-chemistry_matter-and-mole-concept";
const T_BIO_1 = "exam_neet_biology_diversity-in-living-world_living-world-and-taxonomy";

function progress(
  topicId: string,
  status: TopicStatus,
  extra: Partial<UserTopicProgress> = {}
): UserTopicProgress {
  return {
    id: `prog_${topicId}`,
    workspaceId: "ws_test",
    topicId,
    status,
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
    createdAt: AT,
    updatedAt: AT,
    ...extra,
  };
}

function revisionItem(
  topicId: string,
  extra: Partial<RevisionItem> = {}
): RevisionItem {
  return {
    id: `rev_${topicId}`,
    workspaceId: "ws_test",
    topicId,
    revisionNumber: 1,
    lastRevisedAt: null,
    nextRevisionAt: null,
    status: "scheduled",
    createdAt: AT,
    updatedAt: AT,
    ...extra,
  };
}

function localDay(offsetDays: number, hour = 0): Date {
  return new Date(2026, 8, 24 + offsetDays, hour, 0, 0, 0);
}

// ============================================================================
// 1. INTERVALS
// ============================================================================

describe("Revision Domain — Spaced Review Intervals", () => {
  it("locks the canonical interval sequence", () => {
    expect(REVISION_INTERVALS_DAYS).toEqual([1, 3, 7, 14, 30]);
  });

  it("maps revision numbers to intervals deterministically", () => {
    expect(getRevisionIntervalDays(1)).toBe(1);
    expect(getRevisionIntervalDays(2)).toBe(3);
    expect(getRevisionIntervalDays(3)).toBe(7);
    expect(getRevisionIntervalDays(4)).toBe(14);
    expect(getRevisionIntervalDays(5)).toBe(30);
    expect(getRevisionIntervalDays(6)).toBe(30);
    expect(getRevisionIntervalDays(50)).toBe(30);
  });

  it("rejects nonsense revision numbers defensively", () => {
    expect(getRevisionIntervalDays(0)).toBe(1);
    expect(getRevisionIntervalDays(-3)).toBe(1);
  });
});

// ============================================================================
// 2. DATE HELPERS & BOUNDARIES
// ============================================================================

describe("Revision Domain — Local Date Boundaries", () => {
  it("computes local day bounds without UTC drift", () => {
    const d = new Date(2026, 8, 24, 15, 45, 10, 500);
    expect(startOfLocalDay(d).getFullYear()).toBe(2026);
    expect(startOfLocalDay(d).getHours()).toBe(0);
    expect(startOfLocalDay(d).getMinutes()).toBe(0);
    expect(endOfLocalDay(d).getHours()).toBe(23);
    expect(endOfLocalDay(d).getSeconds()).toBe(59);
    expect(endOfLocalDay(d).getMilliseconds()).toBe(999);
  });

  it("adds local calendar days across month edges", () => {
    expect(addLocalDays(new Date(2026, 8, 30), 3).getMonth()).toBe(9); // Sep 30 -> Oct 3
    expect(addLocalDays(new Date(2026, 8, 30), 3).getDate()).toBe(3);
    expect(diffLocalDays(new Date(2026, 8, 24), new Date(2026, 8, 27))).toBe(3);
    expect(diffLocalDays(new Date(2026, 8, 27), new Date(2026, 8, 24))).toBe(-3);
    expect(diffLocalDays(new Date(2026, 8, 24), new Date(2026, 8, 24))).toBe(0);
  });

  it("coerces persisted epoch numbers and ISO strings safely", () => {
    const viaEpoch = toDate(AT.getTime());
    const viaIso = toDate(AT.toISOString());
    expect(viaEpoch?.getTime()).toBe(AT.getTime());
    expect(viaIso?.getTime()).toBe(AT.getTime());
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate("not-a-date")).toBeNull();
  });

  it("treats just-before-midnight today and just-after-midnight tomorrow correctly", () => {
    // Today at 23:59:59.999 → due
    expect(isRevisionDue(new Date(2026, 8, 24, 23, 59, 59, 999), REF)).toBe(true);
    // Tomorrow at 00:00 → not yet due
    expect(isRevisionDue(new Date(2026, 8, 25, 0, 0, 0, 0), REF)).toBe(false);
    // Yesterday → due AND overdue
    expect(isRevisionDue(new Date(2026, 8, 23, 10, 0, 0), REF)).toBe(true);
    expect(isRevisionOverdue(new Date(2026, 8, 23, 10, 0, 0), REF)).toBe(true);
    // Today → due but never overdue
    expect(isRevisionOverdue(new Date(2026, 8, 24, 0, 0, 0, 0), REF)).toBe(false);
    expect(isRevisionOverdue(new Date(2026, 8, 24, 23, 59, 59, 999), REF)).toBe(false);
    // Tomorrow → neither
    expect(isRevisionDue(new Date(2026, 8, 25, 8, 0, 0), REF)).toBe(false);
    expect(isRevisionOverdue(new Date(2026, 8, 25, 8, 0, 0), REF)).toBe(false);
  });

  it("classifies revisions into mutually exclusive buckets", () => {
    expect(classifyRevision(new Date(2026, 8, 23, 23, 59, 59), REF)).toBe("overdue");
    expect(classifyRevision(new Date(2026, 8, 24, 0, 0, 0), REF)).toBe("due");
    expect(classifyRevision(new Date(2026, 8, 24, 18, 0, 0), REF)).toBe("due");
    expect(classifyRevision(new Date(2026, 8, 25, 0, 0, 0), REF)).toBe("upcoming");
  });
});

// ============================================================================
// 3. SCHEDULING
// ============================================================================

describe("Revision Domain — Deterministic Scheduling", () => {
  it("anchors the next revision to local midnight of the completion day", () => {
    const next = calculateNextRevisionDate(1, new Date(2026, 8, 24, 22, 15, 0));
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(8);
    expect(next.getDate()).toBe(27); // +3 days (revision #2)
    expect(next.getHours()).toBe(0);
    expect(next.getMinutes()).toBe(0);
  });

  it("schedules the full interval ladder from completion", () => {
    // Completing revision #1 → revision #2 in 3 days
    expect(calculateNextRevisionDate(1, AT).getTime()).toBe(localDay(3).getTime());
    // Completing #2 → #3 in 7 days
    expect(calculateNextRevisionNumber(2).getTime()).toBe(localDay(7).getTime());
    // Completing #3 → #4 in 14 days
    expect(calculateNextRevisionNumber(3).getTime()).toBe(localDay(14).getTime());
    // Completing #4 → #5 in 30 days
    expect(calculateNextRevisionNumber(4).getTime()).toBe(localDay(30).getTime());
    // Completing #7 → #8 in 30 days (capped)
    expect(calculateNextRevisionNumber(7).getTime()).toBe(localDay(30).getTime());
  });

  it("schedules across midnight boundaries consistently", () => {
    // Revising at 23:59 the day still anchors to that local day
    const beforeMidnight = calculateNextRevisionDate(1, new Date(2026, 8, 24, 23, 59, 0));
    expect(beforeMidnight.getTime()).toBe(localDay(3).getTime());
    // Revising at 00:01 the next day anchors one day later
    const afterMidnight = calculateNextRevisionDate(1, new Date(2026, 8, 25, 0, 1, 0));
    expect(afterMidnight.getTime()).toBe(localDay(4).getTime());
  });

  it("schedules the first revision one day out", () => {
    expect(scheduleFirstRevisionDate(AT).getTime()).toBe(localDay(1).getTime());
  });

  function calculateNextRevisionNumber(completed: number) {
    return calculateNextRevisionDate(completed, AT);
  }
});

// ============================================================================
// 4. ELIGIBILITY
// ============================================================================

describe("Revision Domain — Eligibility", () => {
  const due = localDay(0, 9);

  it("includes covered and learning topics with a schedule", () => {
    for (const status of ["learning", "learned", "practiced", "revised", "mastered"] as TopicStatus[]) {
      expect(isRevisionEligible(status, due, null)).toBe(true);
    }
  });

  it("never queues untouched or reset topics", () => {
    expect(isRevisionEligible("not_started", due, null)).toBe(false);
  });

  it("excludes topics without a schedule", () => {
    expect(isRevisionEligible("learned", null, null)).toBe(false);
  });

  it("excludes skipped revision items", () => {
    expect(isRevisionEligible("learned", due, revisionItem(T_PHYSICS_1, { status: "skipped" }))).toBe(false);
    expect(isRevisionEligible("learned", due, revisionItem(T_PHYSICS_1, { status: "scheduled" }))).toBe(true);
  });
});

// ============================================================================
// 5. QUEUE BUILDING, SORTING & SUMMARY
// ============================================================================

function buildQueue(
  progressList: UserTopicProgress[],
  revisionItems: RevisionItem[] = [],
  referenceDate: Date = REF
) {
  return getRevisionQueue({
    examAttemptId: "attempt_neet_2027",
    progressList,
    revisionItems,
    referenceDate,
  });
}

describe("Revision Domain — Queue Buckets & Sorting", () => {
  it("distributes revisions into due / overdue / upcoming with counts", () => {
    const queue = buildQueue([
      progress(T_PHYSICS_1, "learned", { nextRevisionAt: localDay(0, 9) }),
      progress(T_PHYSICS_2, "learned", { nextRevisionAt: localDay(-3, 9) }),
      progress(T_PHYSICS_3, "learned", { nextRevisionAt: localDay(4, 9) }),
      progress(T_CHEM_1, "learned", { nextRevisionAt: localDay(1, 9) }),
    ]);

    expect(queue.dueToday.map((e) => e.topicId)).toEqual([T_PHYSICS_1]);
    expect(queue.overdue.map((e) => e.topicId)).toEqual([T_PHYSICS_2]);
    expect(queue.upcoming.map((e) => e.topicId)).toEqual([T_CHEM_1, T_PHYSICS_3]);
    expect(queue.summary).toEqual({
      dueToday: 1,
      overdue: 1,
      upcoming: 2,
      recentlyRevised: 0,
    });
  });

  it("sorts overdue oldest-first, due earliest-first, upcoming nearest-first", () => {
    const queue = buildQueue([
      progress(T_PHYSICS_1, "learned", { nextRevisionAt: localDay(-1, 9) }),
      progress(T_PHYSICS_2, "learned", { nextRevisionAt: localDay(-5, 9) }),
      progress(T_PHYSICS_3, "learned", { nextRevisionAt: localDay(6, 9) }),
      progress(T_CHEM_1, "learned", { nextRevisionAt: localDay(2, 9) }),
      progress(T_BIO_1, "learned", { nextRevisionAt: localDay(3, 9) }),
    ]);

    expect(queue.overdue.map((e) => e.topicId)).toEqual([T_PHYSICS_2, T_PHYSICS_1]);
    expect(queue.upcoming.map((e) => e.topicId)).toEqual([T_CHEM_1, T_BIO_1, T_PHYSICS_3]);
  });

  it("breaks date ties with canonical syllabus order, not row order", () => {
    // Supplied deliberately out of canonical order.
    const queue = buildQueue([
      progress(T_CHEM_1, "learned", { nextRevisionAt: localDay(0, 9) }),
      progress(T_PHYSICS_2, "learned", { nextRevisionAt: localDay(0, 9) }),
      progress(T_PHYSICS_1, "learned", { nextRevisionAt: localDay(0, 9) }),
    ]);
    expect(queue.dueToday.map((e) => e.topicId)).toEqual([T_PHYSICS_1, T_PHYSICS_2, T_CHEM_1]);
  });

  it("prefers the revision item schedule over the progress schedule", () => {
    const queue = buildQueue(
      [progress(T_PHYSICS_1, "learned", { nextRevisionAt: localDay(-9, 9) })],
      [revisionItem(T_PHYSICS_1, { nextRevisionAt: localDay(2, 9), revisionNumber: 3 })]
    );
    expect(queue.upcoming).toHaveLength(1);
    expect(queue.upcoming[0].revisionNumber).toBe(3);
  });

  it("ignores progress rows for topics outside the exam taxonomy", () => {
    const queue = buildQueue([
      progress("exam_jee_math_algebra_polynomials", "learned", { nextRevisionAt: localDay(0, 9) }),
    ]);
    expect(queue.dueToday).toHaveLength(0);
  });

  it("excludes not_started topics even when a stale schedule exists", () => {
    const queue = buildQueue(
      [progress(T_PHYSICS_1, "not_started", { nextRevisionAt: localDay(0, 9) })],
      [revisionItem(T_PHYSICS_1, { nextRevisionAt: localDay(0, 9) })]
    );
    expect(queue.dueToday).toHaveLength(0);
  });

  it("returns an empty queue with zeroed summary for a fresh workspace", () => {
    const queue = buildQueue([]);
    expect(queue.dueToday).toEqual([]);
    expect(queue.overdue).toEqual([]);
    expect(queue.upcoming).toEqual([]);
    expect(queue.recentlyRevised).toEqual([]);
    expect(queue.summary).toEqual({
      dueToday: 0,
      overdue: 0,
      upcoming: 0,
      recentlyRevised: 0,
    });
  });

  it("carries topic metadata and revision context on each entry", () => {
    const lastRevised = localDay(-2, 10);
    const lastStudied = localDay(-1, 11);
    const queue = buildQueue(
      [progress(T_PHYSICS_1, "learned", { lastRevisedAt: lastRevised, lastStudiedAt: lastStudied })],
      [revisionItem(T_PHYSICS_1, { nextRevisionAt: localDay(0, 9), revisionNumber: 2, lastRevisedAt: lastRevised })]
    );
    const entry = queue.dueToday[0];
    expect(entry.topicName).toBe("Units of Measurement, SI Units & Derived Units");
    expect(entry.subjectName).toBe("Physics");
    expect(entry.chapterName).toBe("Physics and Measurement");
    expect(entry.status).toBe("learned");
    expect(entry.bucket).toBe("due");
    expect(entry.revisionNumber).toBe(2);
    expect(entry.lastRevisedAt?.getTime()).toBe(lastRevised.getTime());
    expect(entry.lastStudiedAt?.getTime()).toBe(lastStudied.getTime());
  });
});

// ============================================================================
// 6. RECENTLY REVISED
// ============================================================================

describe("Revision Domain — Recently Revised", () => {
  it("lists revisions newest first within the 7-day window", () => {
    const queue = buildQueue(
      [
        progress(T_PHYSICS_1, "revised", { lastRevisedAt: localDay(-2, 9) }),
        progress(T_PHYSICS_2, "revised", { lastRevisedAt: localDay(0, 8) }),
        progress(T_PHYSICS_3, "revised", { lastRevisedAt: localDay(-8, 9) }), // outside window
      ],
      [],
      new Date(2026, 8, 24, 12, 0, 0)
    );

    expect(queue.recentlyRevised.map((e) => e.topicId)).toEqual([T_PHYSICS_2, T_PHYSICS_1]);
    expect(queue.summary.recentlyRevised).toBe(2);
  });

  it("includes today's revision completed at any hour", () => {
    const queue = buildQueue([
      progress(T_PHYSICS_1, "revised", { lastRevisedAt: new Date(2026, 8, 24, 0, 5, 0) }),
    ]);
    expect(queue.recentlyRevised).toHaveLength(1);
  });

  it("prefers the revision item's lastRevisedAt and derives completed count", () => {
    const queue = buildQueue(
      [progress(T_PHYSICS_1, "revised", { lastRevisedAt: localDay(-5, 9) })],
      [revisionItem(T_PHYSICS_1, { lastRevisedAt: localDay(-1, 9), revisionNumber: 4 })]
    );
    const entry = queue.recentlyRevised[0];
    expect(entry.lastRevisedAt.getTime()).toBe(localDay(-1, 9).getTime());
    expect(entry.completedRevisions).toBe(3);
  });
});

// ============================================================================
// 7. FILTERS
// ============================================================================

describe("Revision Domain — Queue Filters", () => {
  function populatedQueue() {
    return buildQueue([
      progress(T_PHYSICS_1, "learned", { nextRevisionAt: localDay(0, 9) }),
      progress(T_PHYSICS_2, "learned", { nextRevisionAt: localDay(-2, 9) }),
      progress(T_CHEM_1, "learned", { nextRevisionAt: localDay(-1, 9) }),
      progress(T_BIO_1, "learned", { nextRevisionAt: localDay(3, 9) }),
    ]);
  }

  it("keeps the full queue under default filters", () => {
    const filtered = filterRevisionQueue(populatedQueue(), {});
    expect(filtered.dueToday).toHaveLength(1);
    expect(filtered.overdue).toHaveLength(2);
    expect(filtered.upcoming).toHaveLength(1);
  });

  it("narrows to a single status bucket", () => {
    const base = populatedQueue();
    expect(filterRevisionQueue(base, { status: "due" }).dueToday).toHaveLength(1);
    expect(filterRevisionQueue(base, { status: "due" }).overdue).toEqual([]);
    expect(filterRevisionQueue(base, { status: "overdue" }).overdue).toHaveLength(2);
    expect(filterRevisionQueue(base, { status: "overdue" }).dueToday).toEqual([]);
    expect(filterRevisionQueue(base, { status: "upcoming" }).upcoming).toHaveLength(1);
  });

  it("filters by canonical subject slug", () => {
    const filtered = filterRevisionQueue(populatedQueue(), { subject: "physics" });
    expect(filtered.dueToday.map((e) => e.subjectSlug)).toEqual(["physics"]);
    expect(filtered.overdue.map((e) => e.subjectSlug)).toEqual(["physics"]);
    expect(filtered.upcoming).toEqual([]);
  });

  it("combines status and subject filters", () => {
    // Physics + Overdue shows only overdue physics revisions.
    const filtered = filterRevisionQueue(populatedQueue(), { status: "overdue", subject: "physics" });
    expect(filtered.overdue.map((e) => e.topicId)).toEqual([T_PHYSICS_2]);

    // Chemistry + Overdue shows the chemistry overdue topic only.
    const chem = filterRevisionQueue(populatedQueue(), { status: "overdue", subject: "chemistry" });
    expect(chem.overdue.map((e) => e.topicId)).toEqual([T_CHEM_1]);
  });

  it("keeps the unfiltered summary stable for header counts", () => {
    const filtered = filterRevisionQueue(populatedQueue(), { status: "due", subject: "physics" });
    expect(filtered.summary.overdue).toBe(2);
  });
});

// ============================================================================
// 8. COMPLETION
// ============================================================================

describe("Revision Domain — Mark as Revised", () => {
  it("completes the first revision and schedules the second in 3 days", () => {
    const result = applyRevisionCompletion(
      {
        workspaceId: "ws_test",
        topicId: T_PHYSICS_1,
        existingProgress: progress(T_PHYSICS_1, "learned"),
        existingRevisionItem: null,
      },
      AT
    );

    expect(result.completedRevisionNumber).toBe(1);
    expect(result.nextRevisionNumber).toBe(2);
    expect(result.nextIntervalDays).toBe(3);
    expect(result.nextRevisionAt.getTime()).toBe(localDay(3).getTime());

    expect(result.progress.status).toBe("revised");
    expect(result.progress.revisedAt?.getTime()).toBe(AT.getTime());
    expect(result.progress.lastRevisedAt?.getTime()).toBe(AT.getTime());
    expect(result.progress.nextRevisionAt?.getTime()).toBe(localDay(3).getTime());
    expect(result.progress.workspaceId).toBe("ws_test");
    expect(result.progress.topicId).toBe(T_PHYSICS_1);

    expect(result.revisionItem.revisionNumber).toBe(2);
    expect(result.revisionItem.lastRevisedAt?.getTime()).toBe(AT.getTime());
    expect(result.revisionItem.nextRevisionAt?.getTime()).toBe(localDay(3).getTime());
    expect(result.revisionItem.status).toBe("scheduled");
  });

  it("advances the interval ladder from the existing revision item", () => {
    const result = applyRevisionCompletion(
      {
        workspaceId: "ws_test",
        topicId: T_PHYSICS_1,
        existingProgress: progress(T_PHYSICS_1, "revised", { lastRevisedAt: localDay(-7, 9) }),
        existingRevisionItem: revisionItem(T_PHYSICS_1, { revisionNumber: 3, nextRevisionAt: localDay(0, 9) }),
      },
      AT
    );
    expect(result.completedRevisionNumber).toBe(3);
    expect(result.nextRevisionNumber).toBe(4);
    expect(result.nextRevisionAt.getTime()).toBe(localDay(14).getTime());
  });

  it("falls back deterministically when only progress data exists", () => {
    // No revision item, but a prior revision timestamp → completing revision #2.
    const withHistory = applyRevisionCompletion(
      {
        workspaceId: "ws_test",
        topicId: T_PHYSICS_1,
        existingProgress: progress(T_PHYSICS_1, "revised", { lastRevisedAt: localDay(-3, 9) }),
        existingRevisionItem: null,
      },
      AT
    );
    expect(withHistory.completedRevisionNumber).toBe(2);
    expect(withHistory.nextRevisionAt.getTime()).toBe(localDay(7).getTime());

    expect(resolveCompletedRevisionNumber(null, null)).toBe(1);
    expect(resolveCompletedRevisionNumber(null, progress(T_PHYSICS_1, "revised", { revisedAt: localDay(-2, 9) }))).toBe(2);
  });

  it("never demotes stronger preparation states and never auto-masteres", () => {
    const mastered = applyRevisionCompletion(
      {
        workspaceId: "ws_test",
        topicId: T_PHYSICS_1,
        existingProgress: progress(T_PHYSICS_1, "mastered"),
        existingRevisionItem: null,
      },
      AT
    );
    expect(mastered.progress.status).toBe("mastered");
    expect(mastered.progress.masteredAt).toBeNull(); // untouched, not stamped

    const practiced = applyRevisionCompletion(
      {
        workspaceId: "ws_test",
        topicId: T_PHYSICS_1,
        existingProgress: progress(T_PHYSICS_1, "practiced"),
        existingRevisionItem: null,
      },
      AT
    );
    expect(practiced.progress.status).toBe("revised");
  });

  it("preserves factual practice statistics", () => {
    const result = applyRevisionCompletion(
      {
        workspaceId: "ws_test",
        topicId: T_PHYSICS_1,
        existingProgress: progress(T_PHYSICS_1, "practiced", {
          practiceAttempts: 20,
          correctAnswers: 15,
          incorrectAnswers: 5,
          accuracy: 7500,
          notes: "Focus on graphs",
        }),
        existingRevisionItem: null,
      },
      AT
    );
    expect(result.progress.practiceAttempts).toBe(20);
    expect(result.progress.accuracy).toBe(7500);
    expect(result.progress.notes).toBe("Focus on graphs");
  });

  it("keeps existing revision item identity for upsert", () => {
    const item = revisionItem(T_PHYSICS_1, { id: "rev_keep", revisionNumber: 2 });
    const result = applyRevisionCompletion(
      {
        workspaceId: "ws_test",
        topicId: T_PHYSICS_1,
        existingProgress: progress(T_PHYSICS_1, "revised"),
        existingRevisionItem: item,
      },
      AT
    );
    expect(result.revisionItem.id).toBe("rev_keep");
  });
});

// ============================================================================
// 9. STATUS-CHANGE SCHEDULING (Phase 7 integration)
// ============================================================================

describe("Revision Domain — Emergent Scheduling from Progress", () => {
  it("schedules the first revision when a topic becomes covered", () => {
    for (const status of ["learned", "practiced", "mastered"] as TopicStatus[]) {
      expect(scheduleRevisionForStatusChange(status, null, false, AT)?.getTime()).toBe(localDay(1).getTime());
    }
  });

  it("never overwrites an existing schedule from a status change", () => {
    const existing = localDay(5, 9);
    expect(
      scheduleRevisionForStatusChange("learned", existing, false, AT)?.getTime()
    ).toBe(existing.getTime());
  });

  it("clears the schedule on reset to not_started", () => {
    expect(scheduleRevisionForStatusChange("not_started", localDay(2, 9), true, AT)).toBeNull();
  });

  it("treats picking 'revised' as an explicit revision act", () => {
    // No history → completing revision #1 → next in 3 days.
    expect(scheduleRevisionForStatusChange("revised", null, false, AT)?.getTime()).toBe(localDay(3).getTime());
    // Prior revision → completing #2 → next in 7 days.
    expect(scheduleRevisionForStatusChange("revised", null, true, AT)?.getTime()).toBe(localDay(7).getTime());
  });

  it("keeps learning topics unscheduled unless a schedule already exists", () => {
    expect(scheduleRevisionForStatusChange("learning", null, false, AT)).toBeNull();
    const existing = localDay(4, 9);
    expect(scheduleRevisionForStatusChange("learning", existing, false, AT)?.getTime()).toBe(existing.getTime());
  });

  it("applyTopicStatusChange schedules revision #1 when marking learned", () => {
    const patch = applyTopicStatusChange(
      { workspaceId: "ws1", topicId: T_PHYSICS_1, status: "learned", existing: null },
      AT
    );
    expect(patch.nextRevisionAt?.getTime()).toBe(localDay(1).getTime());

    // An existing schedule survives a later status change.
    const patch2 = applyTopicStatusChange(
      {
        workspaceId: "ws1",
        topicId: T_PHYSICS_1,
        status: "practiced",
        existing: progress(T_PHYSICS_1, "learned", { nextRevisionAt: localDay(5, 9) }),
      },
      AT
    );
    expect(patch2.nextRevisionAt?.getTime()).toBe(localDay(5, 9).getTime());
  });

  it("applyTopicStatusChange reset clears the revision schedule", () => {
    const patch = applyTopicStatusChange(
      {
        workspaceId: "ws1",
        topicId: T_PHYSICS_1,
        status: "not_started",
        existing: progress(T_PHYSICS_1, "learned", { nextRevisionAt: localDay(1, 9) }),
      },
      AT
    );
    expect(patch.nextRevisionAt).toBeNull();
  });
});

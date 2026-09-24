import { describe, it, expect } from "vitest";
import {
  applyStudySessionToProgress,
  applyTopicStatusChange,
  buildProgressIndex,
  computeSessionDurationMinutes,
  deriveChapterStatus,
  formatDurationMinutes,
  formatTimerDuration,
  getChapterProgress,
  getNextStudyTarget,
  getStudyOverview,
  getSubjectProgress,
  getSyllabusTree,
  getTopicStatusCounts,
  hasActiveStudyFilters,
  searchAndFilterSubject,
  summarizeRecentStudy,
  type StudyChapterNode,
  type StudySubjectNode,
  type TopicStatus,
} from "@/domain/study";
import type { StudySession, UserTopicProgress } from "@/db/schema";

const AT = new Date("2026-09-23T10:00:00.000Z");

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

function chapter(
  chapterId: string,
  name: string,
  topicIds: string[]
): StudyChapterNode {
  return {
    chapterId,
    name,
    slug: chapterId,
    topics: topicIds.map((id) => ({ topicId: id, name: id.replace(/_/g, " "), slug: id })),
  };
}

function subject(chapters: StudyChapterNode[]): StudySubjectNode {
  return {
    subjectId: "exam_test_subject",
    name: "Test Subject",
    slug: "subject",
    chapters,
  };
}

describe("Study Domain — Syllabus Tree", () => {
  it("builds the canonical NEET tree with locked counts", () => {
    const tree = getSyllabusTree("attempt_neet_2027");
    expect(tree).toHaveLength(3);

    const physics = tree.find((s) => s.slug === "physics")!;
    const chemistry = tree.find((s) => s.slug === "chemistry")!;
    const biology = tree.find((s) => s.slug === "biology")!;

    expect(physics.chapters).toHaveLength(20);
    expect(physics.chapters.reduce((acc, c) => acc + c.topics.length, 0)).toBe(61);
    expect(chemistry.chapters.reduce((acc, c) => acc + c.topics.length, 0)).toBe(40);
    expect(biology.chapters).toHaveLength(12);
    expect(biology.chapters.reduce((acc, c) => acc + c.topics.length, 0)).toBe(38);
  });

  it("derives chapter slugs from canonical IDs", () => {
    const tree = getSyllabusTree("attempt_neet_2027");
    const physics = tree.find((s) => s.slug === "physics")!;
    const kinematics = physics.chapters.find((c) => c.name === "Kinematics")!;
    expect(kinematics.chapterId.endsWith(`_${kinematics.slug}`)).toBe(true);
    expect(kinematics.slug).not.toContain(" ");
  });
});

describe("Study Domain — Chapter Status Derivation", () => {
  it("marks chapters without any progress as not started", () => {
    expect(deriveChapterStatus(5, 0, 0)).toBe("not_started");
    expect(deriveChapterStatus(0, 0, 0)).toBe("not_started");
  });

  it("marks chapters with partial progress as in progress", () => {
    expect(deriveChapterStatus(5, 1, 0)).toBe("in_progress");
    expect(deriveChapterStatus(5, 0, 2)).toBe("in_progress");
    expect(deriveChapterStatus(5, 4, 1)).toBe("in_progress");
  });

  it("marks chapters completed only when every topic is covered", () => {
    expect(deriveChapterStatus(5, 5, 0)).toBe("completed");
    expect(deriveChapterStatus(5, 5, 1)).toBe("completed"); // covered includes all stronger states
    expect(deriveChapterStatus(5, 4, 1)).not.toBe("completed");
  });
});

describe("Study Domain — Chapter & Subject Progress", () => {
  const ch = chapter("ch1", "Chapter One", ["t1", "t2", "t3", "t4"]);
  const ch2 = chapter("ch2", "Chapter Two", ["t5", "t6"]);

  it("computes chapter progress from effective topic statuses", () => {
    const index = buildProgressIndex([
      progress("t1", "learned"),
      progress("t2", "practiced"),
      progress("t3", "learning"),
      // t4 implicit not_started
    ]);
    const stats = getChapterProgress(ch, index);
    expect(stats.total).toBe(4);
    expect(stats.covered).toBe(2);
    expect(stats.learning).toBe(1);
    expect(stats.notStarted).toBe(1);
    expect(stats.percentage).toBe(50);
    expect(stats.status).toBe("in_progress");
  });

  it("treats learning topics as not covered (count-based, no weighting)", () => {
    const index = buildProgressIndex([progress("t1", "learning"), progress("t2", "learning")]);
    const stats = getChapterProgress(ch, index);
    expect(stats.covered).toBe(0);
    expect(stats.percentage).toBe(0);
    expect(stats.status).toBe("in_progress");
  });

  it("aggregates subject progress across chapters", () => {
    const sub = subject([ch, ch2]);
    const index = buildProgressIndex([
      progress("t1", "mastered"),
      progress("t2", "revised"),
      progress("t3", "learned"),
      progress("t4", "learned"),
      progress("t5", "learning"),
    ]);
    const stats = getSubjectProgress(sub, index);
    expect(stats.total).toBe(6);
    expect(stats.covered).toBe(4);
    expect(stats.learning).toBe(1);
    expect(stats.notStarted).toBe(1);
    expect(stats.percentage).toBe(67);
  });
});

describe("Study Domain — Topic Status Aggregation & Overview", () => {
  it("counts every status including implicit not_started", () => {
    const counts = getTopicStatusCounts(
      ["a", "b", "c", "d", "e", "f", "g"],
      buildProgressIndex([
        progress("a", "learning"),
        progress("b", "learned"),
        progress("c", "practiced"),
        progress("d", "revised"),
        progress("e", "mastered"),
      ])
    );
    expect(counts).toMatchObject({
      total: 7,
      notStarted: 2,
      learning: 1,
      learned: 1,
      practiced: 1,
      revised: 1,
      mastered: 1,
      covered: 4,
    });
  });

  it("builds the workspace overview from real progress only", () => {
    const subjects = [
      subject([chapter("ch1", "One", ["a", "b"])]),
      subject([chapter("ch2", "Two", ["c", "d", "e"])]),
    ];
    const overview = getStudyOverview(subjects, buildProgressIndex([progress("a", "learned")]));
    expect(overview).toEqual({
      totalTopics: 5,
      completedTopics: 1,
      learningTopics: 0,
      remainingTopics: 4,
      percentage: 20,
    });
  });

  it("suggests the first untouched topic, then first learning topic", () => {
    const ch1 = chapter("ch1", "One", ["a", "b"]);
    const ch2 = chapter("ch2", "Two", ["c"]);

    const untouched = getNextStudyTarget([ch1, ch2], buildProgressIndex([progress("a", "learned")]));
    expect(untouched?.topic.topicId).toBe("b");
    expect(untouched?.reason).toBe("not_started");

    const allStarted = getNextStudyTarget(
      [ch1, ch2],
      buildProgressIndex([progress("a", "learned"), progress("b", "learning"), progress("c", "mastered")])
    );
    expect(allStarted?.topic.topicId).toBe("b");
    expect(allStarted?.reason).toBe("learning");

    const solo = chapter("solo", "Solo", ["only"]);
    expect(
      getNextStudyTarget([solo], buildProgressIndex([progress("only", "mastered")]))
    ).toBeNull();
  });
});

describe("Study Domain — Search", () => {
  const sub = subject([
    chapter("ch_current", "Current Electricity", ["ce_ohms_law", "ce_cells"]),
    chapter("ch_optics", "Optics", ["op_ray_optics", "op_wave_optics"]),
    chapter("ch_motion", "Laws of Motion", ["lm_newtons_laws", "lm_friction"]),
  ]);

  it("finds chapters by name (case-insensitive) and keeps all their topics", () => {
    const results = searchAndFilterSubject(sub, "current", "all", buildProgressIndex([]));
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Current Electricity");
    expect(results[0].topics).toHaveLength(2);
  });

  it("finds topics by name across chapters", () => {
    const results = searchAndFilterSubject(sub, "ray", "all", buildProgressIndex([]));
    expect(results).toHaveLength(1);
    expect(results[0].topics.map((t) => t.topicId)).toEqual(["op_ray_optics"]);
  });

  it("trims and ignores empty queries", () => {
    expect(searchAndFilterSubject(sub, "   ", "all", buildProgressIndex([]))).toHaveLength(3);
    expect(hasActiveStudyFilters("   ", "all")).toBe(false);
  });
});

describe("Study Domain — Status Filter", () => {
  const sub = subject([
    chapter("ch1", "Chapter One", ["t1", "t2", "t3"]),
    chapter("ch2", "Chapter Two", ["t4"]),
  ]);
  const index = buildProgressIndex([
    progress("t1", "learning"),
    progress("t2", "learned"),
    progress("t3", "mastered"),
  ]);

  it("filters topics by a single status", () => {
    const results = searchAndFilterSubject(sub, "", "learning", index);
    expect(results).toHaveLength(1);
    expect(results[0].topics.map((t) => t.topicId)).toEqual(["t1"]);
  });

  it("not_started filter includes implicit untouched topics", () => {
    const results = searchAndFilterSubject(sub, "", "not_started", index);
    expect(results).toHaveLength(1);
    expect(results[0].topics.map((t) => t.topicId)).toEqual(["t4"]);
  });

  it("drops chapters left with no matching topics", () => {
    const results = searchAndFilterSubject(sub, "", "revised", index);
    expect(results).toHaveLength(0);
  });
});

describe("Study Domain — Search + Filter Combination", () => {
  const sub = subject([
    chapter("ch_current", "Current Electricity", ["ce_ohms_law", "ce_cells", "ce_kirchhoff"]),
    chapter("ch_motion", "Laws of Motion", ["lm_newtons_laws"]),
  ]);
  const index = buildProgressIndex([
    progress("ce_ohms_law", "learning"),
    progress("ce_cells", "learned"),
    progress("lm_newtons_laws", "learning"),
  ]);

  it("intersects query and status filter", () => {
    // Topic names render ids as words ("ohms law"), so the query matches by name.
    const results = searchAndFilterSubject(sub, "ohms", "learning", index);
    expect(results).toHaveLength(1);
    expect(results[0].topics.map((t) => t.topicId)).toEqual(["ce_ohms_law"]);
  });

  it("chapter-name matches respect the status filter too", () => {
    const results = searchAndFilterSubject(sub, "current", "learned", index);
    expect(results).toHaveLength(1);
    expect(results[0].topics.map((t) => t.topicId)).toEqual(["ce_cells"]);
  });

  it("returns empty for non-matching combinations", () => {
    const results = searchAndFilterSubject(sub, "current", "mastered", index);
    expect(results).toHaveLength(0);
    expect(hasActiveStudyFilters("current", "mastered")).toBe(true);
  });
});

describe("Study Domain — Topic Status Updates", () => {
  it("creates a fresh progress row for a first status change", () => {
    const patch = applyTopicStatusChange(
      { workspaceId: "ws1", topicId: "t1", status: "learning", existing: null },
      AT
    );
    expect(patch.workspaceId).toBe("ws1");
    expect(patch.topicId).toBe("t1");
    expect(patch.status).toBe("learning");
    expect(patch.startedAt).toEqual(AT);
    expect(patch.lastStudiedAt).toEqual(AT);
    expect(patch.masteredAt).toBeNull();
  });

  it("stamps the milestone matching the new status and preserves other fields", () => {
    const existing = progress("t1", "learning", { startedAt: new Date("2026-09-20T09:00:00Z") });
    existing.id = "prog_keep";
    const patch = applyTopicStatusChange(
      { workspaceId: "ws1", topicId: "t1", status: "learned", existing },
      AT
    );
    expect(patch.id).toBe("prog_keep");
    expect(patch.status).toBe("learned");
    expect(patch.learnedAt).toEqual(AT);
    expect(patch.startedAt?.getTime()).toBe(new Date("2026-09-20T09:00:00Z").getTime());
  });

  it("stamps revised/mastered timestamps for their statuses", () => {
    const revised = applyTopicStatusChange(
      { workspaceId: "ws1", topicId: "t1", status: "revised", existing: null },
      AT
    );
    expect(revised.revisedAt).toEqual(AT);
    expect(revised.lastRevisedAt).toEqual(AT);

    const mastered = applyTopicStatusChange(
      { workspaceId: "ws1", topicId: "t1", status: "mastered", existing: null },
      AT
    );
    expect(mastered.masteredAt).toEqual(AT);
    expect(mastered.lastStudiedAt).toEqual(AT);
  });

  it("resetting to not_started clears preparation timestamps but keeps practice stats", () => {
    const existing = progress("t1", "practiced", {
      startedAt: AT,
      practicedAt: AT,
      practiceAttempts: 12,
      accuracy: 7500,
    });
    const patch = applyTopicStatusChange(
      { workspaceId: "ws1", topicId: "t1", status: "not_started", existing },
      AT
    );
    expect(patch.status).toBe("not_started");
    expect(patch.startedAt).toBeNull();
    expect(patch.practicedAt).toBeNull();
    expect(patch.lastStudiedAt).toBeNull();
    expect(patch.practiceAttempts).toBe(12);
    expect(patch.accuracy).toBe(7500);
  });
});

describe("Study Domain — Study Session Handling", () => {
  it("records sub-minute sessions as one minute and rounds longer ones", () => {
    const start = new Date("2026-09-23T10:00:00Z");
    expect(computeSessionDurationMinutes(start, new Date("2026-09-23T10:00:20Z"))).toBe(1);
    expect(computeSessionDurationMinutes(start, new Date("2026-09-23T10:00:45Z"))).toBe(1);
    expect(computeSessionDurationMinutes(start, new Date("2026-09-23T10:23:41Z"))).toBe(24);
    expect(computeSessionDurationMinutes(start, new Date("2026-09-23T11:30:00Z"))).toBe(90);
  });

  it("never returns zero or negative durations", () => {
    const start = new Date("2026-09-23T10:00:00Z");
    expect(computeSessionDurationMinutes(start, start)).toBe(1);
    expect(computeSessionDurationMinutes(start, new Date("2026-09-23T09:00:00Z"))).toBe(1);
  });

  it("formats durations for humans", () => {
    expect(formatDurationMinutes(0)).toBe("0 min");
    expect(formatDurationMinutes(42)).toBe("42 min");
    expect(formatDurationMinutes(60)).toBe("1 hr");
    expect(formatDurationMinutes(75)).toBe("1 hr 15 min");
    expect(formatDurationMinutes(120)).toBe("2 hrs");
  });

  it("formats live timer durations as HH:MM:SS", () => {
    expect(formatTimerDuration(0)).toBe("00:00:00");
    expect(formatTimerDuration(61)).toBe("00:01:01");
    expect(formatTimerDuration(1421)).toBe("00:23:41");
    expect(formatTimerDuration(3661)).toBe("01:01:01");
  });

  it("groups recent sessions by day with friendly labels", () => {
    // Local calendar days, matching how the domain groups and labels days.
    const ref = new Date(2026, 8, 23, 18, 0, 0);
    const session = (start: Date, minutes: number): StudySession => ({
      id: `s_${start.toISOString()}_${minutes}`,
      workspaceId: "ws1",
      plannerTaskId: null,
      topicId: "t1",
      startedAt: start,
      endedAt: start,
      durationMinutes: minutes,
      sessionType: "focused",
      createdAt: start,
      updatedAt: start,
    });

    const summary = summarizeRecentStudy(
      [
        session(new Date(2026, 8, 23, 9, 0, 0), 42),
        session(new Date(2026, 8, 23, 14, 0, 0), 18),
        session(new Date(2026, 8, 22, 20, 0, 0), 25),
      ],
      ref
    );

    expect(summary).toHaveLength(2);
    expect(summary[0]).toMatchObject({ label: "Today", minutes: 60, sessions: 2 });
    expect(summary[1]).toMatchObject({ label: "Yesterday", minutes: 25, sessions: 1 });
  });

  it("refreshes lastStudiedAt without changing the preparation status", () => {
    const existing = progress("t1", "learned", { learnedAt: AT });
    const patch = applyStudySessionToProgress(
      { workspaceId: "ws1", topicId: "t1", existing },
      AT
    );
    expect(patch.status).toBe("learned");
    expect(patch.lastStudiedAt).toEqual(AT);
    expect(patch.learnedAt).toEqual(AT);

    const fresh = applyStudySessionToProgress({ workspaceId: "ws1", topicId: "t2" }, AT);
    expect(fresh.status).toBe("not_started");
    expect(fresh.startedAt).toEqual(AT);
    expect(fresh.lastStudiedAt).toEqual(AT);
  });
});

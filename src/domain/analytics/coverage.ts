import type { UserTopicProgress } from "@/db/schema";
import {
  buildProgressIndex,
  getTopicStatusCounts,
  deriveChapterStatus,
  getSyllabusTree,
  type DerivedChapterStatus,
  type TopicStatusCounts,
} from "@/domain/study";

/**
 * Preparation coverage (Section 1).
 *
 * Derived from the canonical Exam → Subject → Chapter → Topic hierarchy and
 * the existing `user_topic_progress` status model. Status counting goes
 * through `getTopicStatusCounts` — the same Phase 7 definition the study
 * module uses, so analytics never introduces a second status system.
 *
 * Coverage is cumulative state: it is intentionally not time-filtered.
 */

export interface SubjectCoverageAnalytics extends TopicStatusCounts {
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
  /** Canonical position from the seed dataset (array order). */
  displayOrder: number;
  chaptersCount: number;
  percentage: number;
  chapters: ChapterCoverageAnalytics[];
}

export interface ChapterCoverageAnalytics extends TopicStatusCounts {
  chapterId: string;
  chapterName: string;
  subjectId: string;
  subjectSlug: string;
  percentage: number;
  status: DerivedChapterStatus;
}

export interface CoverageAnalytics {
  /** Canonical topic count for the exam attempt. */
  totalTopics: number;
  counts: TopicStatusCounts;
  /** covered / total, 0–100 rounded. */
  coveragePct: number;
  /** Canonical subject order preserved. */
  subjects: SubjectCoverageAnalytics[];
}

export function buildCoverageAnalytics(
  examAttemptId: string,
  progressList: UserTopicProgress[]
): CoverageAnalytics {
  const tree = getSyllabusTree(examAttemptId);
  const index = buildProgressIndex(progressList);

  const subjects: SubjectCoverageAnalytics[] = tree.map((subject, subjectIndex) => {
    const chapters: ChapterCoverageAnalytics[] = subject.chapters.map((chapter) => {
      const counts = getTopicStatusCounts(
        chapter.topics.map((t) => t.topicId),
        index
      );
      return {
        chapterId: chapter.chapterId,
        chapterName: chapter.name,
        subjectId: subject.subjectId,
        subjectSlug: subject.slug,
        ...counts,
        percentage: percentageOf(counts.covered, counts.total),
        status: deriveChapterStatus(counts.total, counts.covered, counts.learning),
      };
    });

    const topicIds = subject.chapters.flatMap((c) => c.topics.map((t) => t.topicId));
    const counts = getTopicStatusCounts(topicIds, index);
    return {
      subjectId: subject.subjectId,
      subjectName: subject.name,
      subjectSlug: subject.slug,
      displayOrder: subjectIndex,
      chaptersCount: subject.chapters.length,
      ...counts,
      percentage: percentageOf(counts.covered, counts.total),
      chapters,
    };
  });

  const totalTopics = subjects.reduce((acc, s) => acc + s.total, 0);
  const counts: TopicStatusCounts = {
    total: totalTopics,
    notStarted: sum(subjects, (s) => s.notStarted),
    learning: sum(subjects, (s) => s.learning),
    learned: sum(subjects, (s) => s.learned),
    practiced: sum(subjects, (s) => s.practiced),
    revised: sum(subjects, (s) => s.revised),
    mastered: sum(subjects, (s) => s.mastered),
    covered: sum(subjects, (s) => s.covered),
  };

  return {
    totalTopics,
    counts,
    coveragePct: percentageOf(counts.covered, counts.total),
    subjects,
  };
}

function sum(list: TopicStatusCounts[], pick: (item: TopicStatusCounts) => number): number {
  return list.reduce((acc, item) => acc + pick(item), 0);
}

function percentageOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

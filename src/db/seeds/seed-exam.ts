import type { DatabaseInstance } from "@/db";
import { exams, examAttempts, subjects, chapters, topics } from "@/db/schema";
import type { SeedExamData } from "./data/neet";

export interface SeedResult {
  exams: number;
  attempts: number;
  subjects: number;
  chapters: number;
  topics: number;
}

/**
 * Seeds an exam hierarchy idempotently into the database.
 * Uses deterministic stable IDs and SQLite ON CONFLICT DO UPDATE
 * to guarantee that repeated executions never cause duplicate rows or constraint failures.
 */
export async function seedExam(
  db: DatabaseInstance,
  data: SeedExamData
): Promise<SeedResult> {
  const now = new Date();
  let examCount = 0;
  let attemptCount = 0;
  let subjectCount = 0;
  let chapterCount = 0;
  let topicCount = 0;

  // 1. Upsert Exam
  await db
    .insert(exams)
    .values({
      id: data.exam.id,
      slug: data.exam.slug,
      name: data.exam.name,
      shortName: data.exam.shortName,
      description: data.exam.description,
      category: data.exam.category,
      status: data.exam.status,
      metadata: data.exam.metadata,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: exams.slug,
      set: {
        name: data.exam.name,
        shortName: data.exam.shortName,
        description: data.exam.description,
        category: data.exam.category,
        status: data.exam.status,
        metadata: data.exam.metadata,
        updatedAt: now,
      },
    });
  examCount++;

  // 2. Upsert Exam Attempt
  await db
    .insert(examAttempts)
    .values({
      id: data.attempt.id,
      examId: data.exam.id,
      slug: data.attempt.slug,
      label: data.attempt.label,
      examDate: data.attempt.examDate,
      status: data.attempt.status,
      scoringConfig: data.attempt.scoringConfig,
      metadata: data.attempt.metadata,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [examAttempts.examId, examAttempts.slug],
      set: {
        label: data.attempt.label,
        examDate: data.attempt.examDate,
        status: data.attempt.status,
        scoringConfig: data.attempt.scoringConfig,
        metadata: data.attempt.metadata,
        updatedAt: now,
      },
    });
  attemptCount++;

  // 3. Upsert Subjects, Chapters, Topics
  for (const sub of data.subjects) {
    const subjectId = `${data.exam.id}_${sub.slug}`;

    await db
      .insert(subjects)
      .values({
        id: subjectId,
        examId: data.exam.id,
        slug: sub.slug,
        name: sub.name,
        displayOrder: sub.displayOrder,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [subjects.examId, subjects.slug],
        set: {
          name: sub.name,
          displayOrder: sub.displayOrder,
          updatedAt: now,
        },
      });
    subjectCount++;

    for (const chap of sub.chapters) {
      const chapterId = `${subjectId}_${chap.slug}`;

      await db
        .insert(chapters)
        .values({
          id: chapterId,
          subjectId,
          slug: chap.slug,
          name: chap.name,
          displayOrder: chap.displayOrder,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [chapters.subjectId, chapters.slug],
          set: {
            name: chap.name,
            displayOrder: chap.displayOrder,
            updatedAt: now,
          },
        });
      chapterCount++;

      for (const top of chap.topics) {
        const topicId = `${chapterId}_${top.slug}`;

        await db
          .insert(topics)
          .values({
            id: topicId,
            chapterId,
            slug: top.slug,
            name: top.name,
            displayOrder: top.displayOrder,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [topics.chapterId, topics.slug],
            set: {
              name: top.name,
              displayOrder: top.displayOrder,
              updatedAt: now,
            },
          });
        topicCount++;
      }
    }
  }

  return {
    exams: examCount,
    attempts: attemptCount,
    subjects: subjectCount,
    chapters: chapterCount,
    topics: topicCount,
  };
}

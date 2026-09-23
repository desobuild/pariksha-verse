import { eq, and } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import {
  exams,
  examAttempts,
  subjects,
  chapters,
  topics,
  type Topic,
  type NewTopic,
  type Exam,
  type ExamAttempt,
  type Subject,
  type Chapter,
} from "@/db/schema";

export interface TopicHierarchy {
  exam: Exam;
  attempt: ExamAttempt;
  subject: Subject;
  chapter: Chapter;
  topic: Topic;
}

export const topicRepository = {
  async getTopicsByChapterId(db: DatabaseInstance, chapterId: string): Promise<Topic[]> {
    return db
      .select()
      .from(topics)
      .where(eq(topics.chapterId, chapterId))
      .orderBy(topics.displayOrder);
  },

  async getTopicBySlug(
    db: DatabaseInstance,
    chapterId: string,
    slug: string
  ): Promise<Topic | null> {
    const rows = await db
      .select()
      .from(topics)
      .where(and(eq(topics.chapterId, chapterId), eq(topics.slug, slug)))
      .limit(1);
    return rows[0] || null;
  },

  async getTopicById(db: DatabaseInstance, id: string): Promise<Topic | null> {
    const rows = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
    return rows[0] || null;
  },

  async createTopic(db: DatabaseInstance, data: NewTopic): Promise<Topic> {
    const rows = await db.insert(topics).values(data).returning();
    return rows[0];
  },

  /**
   * Retrieves the full canonical content chain from Exam down to Topic.
   */
  async getTopicHierarchy(
    db: DatabaseInstance,
    params: {
      examSlug: string;
      attemptSlug: string;
      subjectSlug: string;
      chapterSlug: string;
      topicSlug: string;
    }
  ): Promise<TopicHierarchy | null> {
    const examRows = await db
      .select()
      .from(exams)
      .where(eq(exams.slug, params.examSlug))
      .limit(1);
    const exam = examRows[0];
    if (!exam) return null;

    const attemptRows = await db
      .select()
      .from(examAttempts)
      .where(
        and(eq(examAttempts.examId, exam.id), eq(examAttempts.slug, params.attemptSlug))
      )
      .limit(1);
    const attempt = attemptRows[0];
    if (!attempt) return null;

    const subjectRows = await db
      .select()
      .from(subjects)
      .where(
        and(eq(subjects.examId, exam.id), eq(subjects.slug, params.subjectSlug))
      )
      .limit(1);
    const subject = subjectRows[0];
    if (!subject) return null;

    const chapterRows = await db
      .select()
      .from(chapters)
      .where(
        and(eq(chapters.subjectId, subject.id), eq(chapters.slug, params.chapterSlug))
      )
      .limit(1);
    const chapter = chapterRows[0];
    if (!chapter) return null;

    const topicRows = await db
      .select()
      .from(topics)
      .where(
        and(eq(topics.chapterId, chapter.id), eq(topics.slug, params.topicSlug))
      )
      .limit(1);
    const topic = topicRows[0];
    if (!topic) return null;

    return { exam, attempt, subject, chapter, topic };
  },
};

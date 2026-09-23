import { eq, and } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import { exams, examAttempts, type Exam, type ExamAttempt, type NewExam, type NewExamAttempt } from "@/db/schema";

export const examRepository = {
  async getAllExams(db: DatabaseInstance): Promise<Exam[]> {
    return db.select().from(exams).orderBy(exams.name);
  },

  async getExamBySlug(db: DatabaseInstance, slug: string): Promise<Exam | null> {
    const rows = await db.select().from(exams).where(eq(exams.slug, slug)).limit(1);
    return rows[0] || null;
  },

  async getExamById(db: DatabaseInstance, id: string): Promise<Exam | null> {
    const rows = await db.select().from(exams).where(eq(exams.id, id)).limit(1);
    return rows[0] || null;
  },

  async createExam(db: DatabaseInstance, data: NewExam): Promise<Exam> {
    const rows = await db.insert(exams).values(data).returning();
    return rows[0];
  },

  async getExamAttempts(db: DatabaseInstance, examId: string): Promise<ExamAttempt[]> {
    return db.select().from(examAttempts).where(eq(examAttempts.examId, examId)).orderBy(examAttempts.slug);
  },

  async getExamAttemptBySlug(
    db: DatabaseInstance,
    examId: string,
    slug: string
  ): Promise<ExamAttempt | null> {
    const rows = await db
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.examId, examId), eq(examAttempts.slug, slug)))
      .limit(1);
    return rows[0] || null;
  },

  async getExamAttemptById(db: DatabaseInstance, id: string): Promise<ExamAttempt | null> {
    const rows = await db.select().from(examAttempts).where(eq(examAttempts.id, id)).limit(1);
    return rows[0] || null;
  },

  async createExamAttempt(db: DatabaseInstance, data: NewExamAttempt): Promise<ExamAttempt> {
    const rows = await db.insert(examAttempts).values(data).returning();
    return rows[0];
  },
};

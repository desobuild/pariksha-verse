import { eq, and } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import { subjects, type Subject, type NewSubject } from "@/db/schema";

export const subjectRepository = {
  async getSubjectsByExamId(db: DatabaseInstance, examId: string): Promise<Subject[]> {
    return db
      .select()
      .from(subjects)
      .where(eq(subjects.examId, examId))
      .orderBy(subjects.displayOrder);
  },

  async getSubjectBySlug(
    db: DatabaseInstance,
    examId: string,
    slug: string
  ): Promise<Subject | null> {
    const rows = await db
      .select()
      .from(subjects)
      .where(and(eq(subjects.examId, examId), eq(subjects.slug, slug)))
      .limit(1);
    return rows[0] || null;
  },

  async getSubjectById(db: DatabaseInstance, id: string): Promise<Subject | null> {
    const rows = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
    return rows[0] || null;
  },

  async createSubject(db: DatabaseInstance, data: NewSubject): Promise<Subject> {
    const rows = await db.insert(subjects).values(data).returning();
    return rows[0];
  },
};

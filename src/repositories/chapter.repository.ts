import { eq, and } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import { chapters, type Chapter, type NewChapter } from "@/db/schema";

export const chapterRepository = {
  async getChaptersBySubjectId(db: DatabaseInstance, subjectId: string): Promise<Chapter[]> {
    return db
      .select()
      .from(chapters)
      .where(eq(chapters.subjectId, subjectId))
      .orderBy(chapters.displayOrder);
  },

  async getChapterBySlug(
    db: DatabaseInstance,
    subjectId: string,
    slug: string
  ): Promise<Chapter | null> {
    const rows = await db
      .select()
      .from(chapters)
      .where(and(eq(chapters.subjectId, subjectId), eq(chapters.slug, slug)))
      .limit(1);
    return rows[0] || null;
  },

  async getChapterById(db: DatabaseInstance, id: string): Promise<Chapter | null> {
    const rows = await db.select().from(chapters).where(eq(chapters.id, id)).limit(1);
    return rows[0] || null;
  },

  async createChapter(db: DatabaseInstance, data: NewChapter): Promise<Chapter> {
    const rows = await db.insert(chapters).values(data).returning();
    return rows[0];
  },
};

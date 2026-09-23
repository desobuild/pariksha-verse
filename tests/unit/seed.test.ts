import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./db-test-adapter";
import type { DatabaseInstance } from "@/db";
import { seedExam } from "@/db/seeds/seed-exam";
import { neetSeedData } from "@/db/seeds/data/neet";
import {
  exams,
  examAttempts,
  subjects,
  chapters,
  topics,
  users,
  userWorkspaces,
  userTopicProgress,
  plannerTasks,
  studySessions,
  mockTests,
} from "@/db/schema";
import { eq } from "drizzle-orm";

describe("NEET Seed System & Idempotency", () => {
  let db: DatabaseInstance;

  beforeEach(() => {
    db = createTestDb();
  });

  it("seeds canonical NEET dataset into database", async () => {
    const result = await seedExam(db, neetSeedData);

    expect(result.exams).toBe(1);
    expect(result.attempts).toBe(1);
    expect(result.subjects).toBe(3);
    expect(result.chapters).toBe(52);
    expect(result.topics).toBe(139);

    const examRows = await db.select().from(exams).where(eq(exams.slug, "neet"));
    expect(examRows).toHaveLength(1);
    expect(examRows[0].shortName).toBe("NEET");
    expect(examRows[0].metadata?.officialConductingBody).toContain("NTA");
    expect(examRows[0].metadata?.sourceScope).toContain("NEET-UG 2024");

    const attemptRows = await db.select().from(examAttempts).where(eq(examAttempts.slug, "neet-2027"));
    expect(attemptRows).toHaveLength(1);
    expect(attemptRows[0].metadata?.syllabusStatus).toBe("provisional");
    expect(attemptRows[0].metadata?.baselineSource).toContain("U.14023/19/2023-UGMEB");

    const subjectRows = await db.select().from(subjects).where(eq(subjects.examId, "exam_neet"));
    expect(subjectRows).toHaveLength(3);
    const subjectSlugs = subjectRows.map((s) => s.slug).sort();
    expect(subjectSlugs).toEqual(["biology", "chemistry", "physics"]);
  });

  it("is fully idempotent when executed multiple times", async () => {
    // First run
    const result1 = await seedExam(db, neetSeedData);
    expect(result1.topics).toBe(139);

    // Second run
    const result2 = await seedExam(db, neetSeedData);
    expect(result2.topics).toBe(139);

    // Verify row counts in DB did not double
    const allExams = await db.select().from(exams);
    const allAttempts = await db.select().from(examAttempts);
    const allSubjects = await db.select().from(subjects);
    const allChapters = await db.select().from(chapters);
    const allTopics = await db.select().from(topics);

    expect(allExams).toHaveLength(1);
    expect(allAttempts).toHaveLength(1);
    expect(allSubjects).toHaveLength(3);
    expect(allChapters).toHaveLength(52);
    expect(allTopics).toHaveLength(139);
  });

  it("contains NO fake user data or progress in production seed", async () => {
    await seedExam(db, neetSeedData);

    const allUsers = await db.select().from(users);
    const allWorkspaces = await db.select().from(userWorkspaces);
    const allProgress = await db.select().from(userTopicProgress);
    const allTasks = await db.select().from(plannerTasks);
    const allSessions = await db.select().from(studySessions);
    const allMockTests = await db.select().from(mockTests);

    expect(allUsers).toHaveLength(0);
    expect(allWorkspaces).toHaveLength(0);
    expect(allProgress).toHaveLength(0);
    expect(allTasks).toHaveLength(0);
    expect(allSessions).toHaveLength(0);
    expect(allMockTests).toHaveLength(0);
  });
});

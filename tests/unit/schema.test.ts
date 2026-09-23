import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./db-test-adapter";
import type { DatabaseInstance } from "@/db";
import {
  exams,
  examAttempts,
  subjects,
  chapters,
  topics,
  users,
  userWorkspaces,
  userTopicProgress,
  resources,
  savedResources,
} from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Database Schema & Relational Integrity", () => {
  let db: DatabaseInstance;
  const now = new Date();

  beforeEach(() => {
    db = createTestDb();
  });

  it("1. inserts an exam correctly", async () => {
    await db.insert(exams).values({
      id: "exam_neet",
      slug: "neet",
      name: "National Eligibility cum Entrance Test",
      shortName: "NEET",
      category: "medical",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(exams).where(eq(exams.id, "exam_neet"));
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe("neet");
    expect(rows[0].shortName).toBe("NEET");
  });

  it("2. inserts exam attempt linked to exam", async () => {
    await db.insert(exams).values({
      id: "exam_neet",
      slug: "neet",
      name: "NEET",
      shortName: "NEET",
      category: "medical",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(examAttempts).values({
      id: "attempt_neet_2027",
      examId: "exam_neet",
      slug: "neet-2027",
      label: "NEET 2027",
      examDate: new Date("2027-05-02"),
      status: "upcoming",
      scoringConfig: {
        totalMarks: 720,
        defaultRule: { correctMarks: 4, incorrectMarks: -1, unattemptedMarks: 0 },
        durationMinutes: 200,
        totalQuestions: 180,
        negativeMarking: true,
      },
      createdAt: now,
      updatedAt: now,
    });

    const attempts = await db.select().from(examAttempts).where(eq(examAttempts.id, "attempt_neet_2027"));
    expect(attempts).toHaveLength(1);
    expect(attempts[0].scoringConfig?.totalMarks).toBe(720);
    expect(attempts[0].scoringConfig?.defaultRule.correctMarks).toBe(4);
  });

  it("3. inserts subject, chapter, and topic in hierarchy", async () => {
    await db.insert(exams).values({
      id: "exam_neet",
      slug: "neet",
      name: "NEET",
      shortName: "NEET",
      category: "medical",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(subjects).values({
      id: "sub_bio",
      examId: "exam_neet",
      slug: "biology",
      name: "Biology",
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(chapters).values({
      id: "chap_human_repro",
      subjectId: "sub_bio",
      slug: "human-reproduction",
      name: "Human Reproduction",
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(topics).values({
      id: "top_gametogenesis",
      chapterId: "chap_human_repro",
      slug: "gametogenesis",
      name: "Gametogenesis: Spermatogenesis & Oogenesis",
      displayOrder: 1,
      createdAt: now,
      updatedAt: now,
    });

    const topicList = await db.select().from(topics).where(eq(topics.id, "top_gametogenesis"));
    expect(topicList).toHaveLength(1);
    expect(topicList[0].name).toContain("Gametogenesis");
  });

  it("4. inserts user, workspace, and topic progress with basis points accuracy", async () => {
    // Setup exam and topic
    await db.insert(exams).values({
      id: "exam_neet",
      slug: "neet",
      name: "NEET",
      shortName: "NEET",
      category: "medical",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(examAttempts).values({
      id: "attempt_neet_2027",
      examId: "exam_neet",
      slug: "neet-2027",
      label: "NEET 2027",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(subjects).values({
      id: "sub_bio",
      examId: "exam_neet",
      slug: "biology",
      name: "Biology",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(chapters).values({
      id: "chap_hr",
      subjectId: "sub_bio",
      slug: "human-reproduction",
      name: "Human Reproduction",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(topics).values({
      id: "top_mc",
      chapterId: "chap_hr",
      slug: "menstrual-cycle",
      name: "Menstrual Cycle",
      createdAt: now,
      updatedAt: now,
    });

    // Create user and workspace
    await db.insert(users).values({
      id: "user_test_1",
      email: "aspirant@example.com",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(userWorkspaces).values({
      id: "ws_1",
      userId: "user_test_1",
      examAttemptId: "attempt_neet_2027",
      isActive: true,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Topic progress with 85.50% accuracy stored as 8550 basis points
    await db.insert(userTopicProgress).values({
      id: "prog_1",
      workspaceId: "ws_1",
      topicId: "top_mc",
      status: "practiced",
      practiceAttempts: 20,
      correctAnswers: 17,
      incorrectAnswers: 3,
      accuracy: 8500, // 85.00%
      createdAt: now,
      updatedAt: now,
    });

    const progressRows = await db
      .select()
      .from(userTopicProgress)
      .where(eq(userTopicProgress.id, "prog_1"));
    expect(progressRows).toHaveLength(1);
    expect(progressRows[0].status).toBe("practiced");
    expect(progressRows[0].accuracy).toBe(8500);
  });

  describe("Data Integrity & Constraint Rejection", () => {
    it("rejects duplicate exam slug", async () => {
      await db.insert(exams).values({
        id: "exam_1",
        slug: "neet",
        name: "NEET 1",
        shortName: "NEET",
        category: "medical",
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(exams).values({
          id: "exam_2",
          slug: "neet", // duplicate slug
          name: "NEET 2",
          shortName: "NEET",
          category: "medical",
          createdAt: now,
          updatedAt: now,
        })
      ).rejects.toThrow(/UNIQUE constraint failed/);
    });

    it("rejects duplicate subject under same exam", async () => {
      await db.insert(exams).values({
        id: "exam_neet",
        slug: "neet",
        name: "NEET",
        shortName: "NEET",
        category: "medical",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(subjects).values({
        id: "sub_1",
        examId: "exam_neet",
        slug: "physics",
        name: "Physics",
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(subjects).values({
          id: "sub_2",
          examId: "exam_neet",
          slug: "physics", // duplicate under same exam
          name: "Physics Duplicate",
          createdAt: now,
          updatedAt: now,
        })
      ).rejects.toThrow(/UNIQUE constraint failed/);
    });

    it("rejects duplicate chapter under same subject", async () => {
      await db.insert(exams).values({
        id: "exam_neet",
        slug: "neet",
        name: "NEET",
        shortName: "NEET",
        category: "medical",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(subjects).values({
        id: "sub_phy",
        examId: "exam_neet",
        slug: "physics",
        name: "Physics",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(chapters).values({
        id: "chap_1",
        subjectId: "sub_phy",
        slug: "kinematics",
        name: "Kinematics",
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(chapters).values({
          id: "chap_2",
          subjectId: "sub_phy",
          slug: "kinematics", // duplicate under same subject
          name: "Kinematics Duplicate",
          createdAt: now,
          updatedAt: now,
        })
      ).rejects.toThrow(/UNIQUE constraint failed/);
    });

    it("rejects duplicate topic under same chapter", async () => {
      await db.insert(exams).values({
        id: "exam_neet",
        slug: "neet",
        name: "NEET",
        shortName: "NEET",
        category: "medical",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(subjects).values({
        id: "sub_phy",
        examId: "exam_neet",
        slug: "physics",
        name: "Physics",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(chapters).values({
        id: "chap_kin",
        subjectId: "sub_phy",
        slug: "kinematics",
        name: "Kinematics",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(topics).values({
        id: "top_1",
        chapterId: "chap_kin",
        slug: "vectors",
        name: "Vectors",
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(topics).values({
          id: "top_2",
          chapterId: "chap_kin",
          slug: "vectors", // duplicate under same chapter
          name: "Vectors Duplicate",
          createdAt: now,
          updatedAt: now,
        })
      ).rejects.toThrow(/UNIQUE constraint failed/);
    });

    it("rejects duplicate saved resource for same workspace", async () => {
      await db.insert(exams).values({
        id: "exam_neet",
        slug: "neet",
        name: "NEET",
        shortName: "NEET",
        category: "medical",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(examAttempts).values({
        id: "attempt_neet",
        examId: "exam_neet",
        slug: "neet-2027",
        label: "NEET 2027",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(users).values({
        id: "user_1",
        email: "user@example.com",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(userWorkspaces).values({
        id: "ws_1",
        userId: "user_1",
        examAttemptId: "attempt_neet",
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(resources).values({
        id: "res_1",
        examId: "exam_neet",
        title: "NCERT Biology",
        type: "ncert",
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(savedResources).values({
        id: "sr_1",
        workspaceId: "ws_1",
        resourceId: "res_1",
        savedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await expect(
        db.insert(savedResources).values({
          id: "sr_2",
          workspaceId: "ws_1",
          resourceId: "res_1", // duplicate saved resource
          savedAt: now,
          createdAt: now,
          updatedAt: now,
        })
      ).rejects.toThrow(/UNIQUE constraint failed/);
    });

    it("rejects foreign key violation when referencing nonexistent parent", async () => {
      await expect(
        db.insert(subjects).values({
          id: "sub_orphan",
          examId: "nonexistent_exam",
          slug: "orphan-subject",
          name: "Orphan",
          createdAt: now,
          updatedAt: now,
        })
      ).rejects.toThrow(/FOREIGN KEY constraint failed/);
    });

    it("cascades deletion properly from workspace to topic progress", async () => {
      await db.insert(exams).values({
        id: "exam_neet",
        slug: "neet",
        name: "NEET",
        shortName: "NEET",
        category: "medical",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(examAttempts).values({
        id: "attempt_neet",
        examId: "exam_neet",
        slug: "neet-2027",
        label: "NEET 2027",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(subjects).values({
        id: "sub_b",
        examId: "exam_neet",
        slug: "bio",
        name: "Bio",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(chapters).values({
        id: "chap_b",
        subjectId: "sub_b",
        slug: "cell",
        name: "Cell",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(topics).values({
        id: "top_b",
        chapterId: "chap_b",
        slug: "cell-theory",
        name: "Cell Theory",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(users).values({
        id: "user_c",
        email: "cascade@example.com",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(userWorkspaces).values({
        id: "ws_c",
        userId: "user_c",
        examAttemptId: "attempt_neet",
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(userTopicProgress).values({
        id: "prog_c",
        workspaceId: "ws_c",
        topicId: "top_b",
        status: "mastered",
        createdAt: now,
        updatedAt: now,
      });

      // Verify progress exists
      const before = await db.select().from(userTopicProgress).where(eq(userTopicProgress.id, "prog_c"));
      expect(before).toHaveLength(1);

      // Delete workspace -> should cascade delete progress
      await db.delete(userWorkspaces).where(eq(userWorkspaces.id, "ws_c"));

      const after = await db.select().from(userTopicProgress).where(eq(userTopicProgress.id, "prog_c"));
      expect(after).toHaveLength(0);
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./db-test-adapter";
import type { DatabaseInstance } from "@/db";
import { seedExam } from "@/db/seeds/seed-exam";
import { neetSeedData } from "@/db/seeds/data/neet";
import {
  examRepository,
  subjectRepository,
  chapterRepository,
  topicRepository,
  workspaceRepository,
  topicProgressRepository,
} from "@/repositories";
import { users } from "@/db/schema";

describe("Repository Layer & Integration Hierarchy Retrieval", () => {
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createTestDb();
    await seedExam(db, neetSeedData);
  });

  it("retrieves exam and its attempt via examRepository", async () => {
    const exam = await examRepository.getExamBySlug(db, "neet");
    expect(exam).not.toBeNull();
    expect(exam?.shortName).toBe("NEET");

    const attempts = await examRepository.getExamAttempts(db, exam!.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].slug).toBe("neet-2027");

    const attempt = await examRepository.getExamAttemptBySlug(db, exam!.id, "neet-2027");
    expect(attempt).not.toBeNull();
    expect(attempt?.label).toBe("NEET 2027");
    expect(attempt?.scoringConfig?.totalMarks).toBe(720);
  });

  it("retrieves subjects via subjectRepository", async () => {
    const exam = await examRepository.getExamBySlug(db, "neet");
    const subjects = await subjectRepository.getSubjectsByExamId(db, exam!.id);

    expect(subjects).toHaveLength(3);
    const names = subjects.map((s) => s.name);
    expect(names).toContain("Physics");
    expect(names).toContain("Chemistry");
    expect(names).toContain("Biology");

    const bio = await subjectRepository.getSubjectBySlug(db, exam!.id, "biology");
    expect(bio).not.toBeNull();
    expect(bio?.name).toBe("Biology");
  });

  it("retrieves chapters via chapterRepository", async () => {
    const exam = await examRepository.getExamBySlug(db, "neet");
    const bio = await subjectRepository.getSubjectBySlug(db, exam!.id, "biology");
    const chapters = await chapterRepository.getChaptersBySubjectId(db, bio!.id);

    expect(chapters.length).toBeGreaterThan(5);
    const chapterSlugs = chapters.map((c) => c.slug);
    expect(chapterSlugs).toContain("human-reproduction");

    const hr = await chapterRepository.getChapterBySlug(db, bio!.id, "human-reproduction");
    expect(hr).not.toBeNull();
    expect(hr?.name).toBe("Human Reproduction");
  });

  it("retrieves topics via topicRepository", async () => {
    const exam = await examRepository.getExamBySlug(db, "neet");
    const bio = await subjectRepository.getSubjectBySlug(db, exam!.id, "biology");
    const hr = await chapterRepository.getChapterBySlug(db, bio!.id, "human-reproduction");
    const topics = await topicRepository.getTopicsByChapterId(db, hr!.id);

    expect(topics.length).toBeGreaterThanOrEqual(5);
    const topicSlugs = topics.map((t) => t.slug);
    expect(topicSlugs).toContain("menstrual-cycle");
    expect(topicSlugs).toContain("gametogenesis");

    const topic = await topicRepository.getTopicBySlug(db, hr!.id, "menstrual-cycle");
    expect(topic).not.toBeNull();
    expect(topic?.name).toContain("Menstrual Cycle");
  });

  it("retrieves complete canonical hierarchy: NEET -> NEET 2027 -> Biology -> Human Reproduction -> topic", async () => {
    const hierarchy = await topicRepository.getTopicHierarchy(db, {
      examSlug: "neet",
      attemptSlug: "neet-2027",
      subjectSlug: "biology",
      chapterSlug: "human-reproduction",
      topicSlug: "menstrual-cycle",
    });

    expect(hierarchy).not.toBeNull();
    expect(hierarchy?.exam.slug).toBe("neet");
    expect(hierarchy?.attempt.slug).toBe("neet-2027");
    expect(hierarchy?.subject.slug).toBe("biology");
    expect(hierarchy?.chapter.slug).toBe("human-reproduction");
    expect(hierarchy?.topic.slug).toBe("menstrual-cycle");
    expect(hierarchy?.topic.name).toBe("Menstrual Cycle Phases and Hormonal Regulation");
  });

  it("manages workspaces and topic progress via repositories", async () => {
    const exam = await examRepository.getExamBySlug(db, "neet");
    const attempt = await examRepository.getExamAttemptBySlug(db, exam!.id, "neet-2027");

    const now = new Date();
    await db.insert(users).values({
      id: "user_test_repo",
      email: "repo_user@example.com",
      createdAt: now,
      updatedAt: now,
    });

    // Create workspace
    const ws = await workspaceRepository.createWorkspace(db, {
      id: "ws_repo_1",
      userId: "user_test_repo",
      examAttemptId: attempt!.id,
      isActive: true,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    expect(ws.id).toBe("ws_repo_1");

    const active = await workspaceRepository.getActiveWorkspace(db, "user_test_repo");
    expect(active?.id).toBe("ws_repo_1");

    // Retrieve topic
    const hr = await chapterRepository.getChapterBySlug(
      db,
      `${exam!.id}_biology`,
      "human-reproduction"
    );
    const topic = await topicRepository.getTopicBySlug(db, hr!.id, "gametogenesis");

    // Upsert topic progress
    const progress = await topicProgressRepository.upsertTopicProgress(db, {
      id: "prog_repo_1",
      workspaceId: ws.id,
      topicId: topic!.id,
      status: "mastered",
      practiceAttempts: 50,
      correctAnswers: 46,
      incorrectAnswers: 4,
      accuracy: 9200, // 92.00%
      createdAt: now,
      updatedAt: now,
    });
    expect(progress.status).toBe("mastered");
    expect(progress.accuracy).toBe(9200);

    const fetchedProgress = await topicProgressRepository.getTopicProgress(
      db,
      ws.id,
      topic!.id
    );
    expect(fetchedProgress?.accuracy).toBe(9200);
    expect(fetchedProgress?.status).toBe("mastered");
  });
});

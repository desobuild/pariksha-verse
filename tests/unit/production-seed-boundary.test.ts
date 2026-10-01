import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { createTestD1Database } from "./db-test-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { DatabaseInstance } from "@/db";
import { eq, sql } from "drizzle-orm";
import {
  questionRepository,
  isFixtureQuestionSeedingAllowed,
} from "@/repositories/question.repository";
import { generateSeedSql } from "@/db/seeds/generate-sql";
import { resolveSeedTarget, SEED_TARGETS } from "@/db/seeds/targets";
import { seedExam } from "@/db/seeds/seed-exam";
import { neetSeedData } from "@/db/seeds/data/neet";
import { FIXTURE_QUESTIONS } from "@/domain/practice-engine/fixtures";
import { AUTHORED_QUESTIONS } from "@/data/questions/neet-authored";
import type { CloudflareEnv } from "@/types/cloudflare";

/**
 * Phase 14D — Production data + seed integrity.
 *
 * Pins the production data policy:
 * - fixture/test questions can NEVER be auto-seeded when ENVIRONMENT=production;
 * - the canonical production seed (generateSeedSql) contains exactly the
 *   canonical NEET taxonomy + the 150 authored questions and NOTHING else —
 *   no fixtures, no users, no application data;
 * - the seed is idempotent across repeated runs;
 * - the seed runner can only target the database declared for the chosen
 *   environment in wrangler.jsonc.
 */

async function applySeedSql(d1: D1Database, sqlText: string): Promise<void> {
  await d1.exec(sqlText);
}

async function countRows(db: DatabaseInstance, query: string): Promise<number> {
  const result = await db.all<{ n: number }>(sql.raw(query));
  return Number(result[0]?.n ?? 0);
}

function readWranglerConfig(): {
  d1_databases: Array<{ database_name: string; database_id: string }>;
  env: Record<
    string,
    {
      d1_databases: Array<{ database_name: string; database_id: string }>;
      vars: Record<string, string>;
    }
  >;
} {
  const content = fs.readFileSync(path.resolve(process.cwd(), "wrangler.jsonc"), "utf-8");
  const sanitized = content
    .replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(sanitized);
}

describe("Phase 14D — Production seed boundary & canonical data integrity", () => {
  let currentD1: D1Database;
  let db: DatabaseInstance;
  const originalCfEnv = globalThis.__CLOUDFLARE_ENV__;
  const originalEnvEnvironment = process.env.ENVIRONMENT;

  function setEnvironment(env: string | undefined) {
    globalThis.__CLOUDFLARE_ENV__ = {
      DB: currentD1,
      ...(env ? { ENVIRONMENT: env } : {}),
    } as unknown as CloudflareEnv;
  }

  beforeEach(() => {
    currentD1 = createTestD1Database();
    db = drizzle(currentD1, { schema });
    // Default: local development shape — a D1 binding, NO ENVIRONMENT.
    setEnvironment(undefined);
    delete process.env.ENVIRONMENT;
  });

  afterEach(() => {
    globalThis.__CLOUDFLARE_ENV__ = originalCfEnv;
    if (originalEnvEnvironment === undefined) {
      delete process.env.ENVIRONMENT;
    } else {
      process.env.ENVIRONMENT = originalEnvEnvironment;
    }
  });

  // --------------------------------------------------------------------------
  // A. Fixture-question production boundary (P0 closure)
  // --------------------------------------------------------------------------
  describe("A. fixture questions can never be auto-seeded in production", () => {
    it("refuses fixture seeding exactly and only in production", () => {
      setEnvironment("production");
      expect(isFixtureQuestionSeedingAllowed()).toBe(false);

      setEnvironment("staging");
      expect(isFixtureQuestionSeedingAllowed()).toBe(true);

      setEnvironment(undefined);
      expect(isFixtureQuestionSeedingAllowed()).toBe(true);
    });

    it("production + empty question table: fixture seed is NOT executed, authored bank self-heals", async () => {
      setEnvironment("production");
      await seedExam(db, neetSeedData);

      await questionRepository.ensureFixtureQuestionsSeeded(db);

      const fixtureCount = await countRows(
        db,
        "SELECT COUNT(*) AS n FROM questions WHERE provenance = 'fixture'"
      );
      expect(fixtureCount).toBe(0);

      // The canonical read path works and never injects fixtures
      const all = await questionRepository.getAllQuestions(db);
      expect(all).toHaveLength(AUTHORED_QUESTIONS.length);
      expect(all.every((q) => q.provenance === "authored")).toBe(true);
      expect(all.some((q) => q.id.startsWith("q_fix_"))).toBe(false);

      const rows = await db.select().from(schema.questions);
      expect(rows.some((q) => q.id.startsWith("q_fix_"))).toBe(false);
      expect(rows.every((q) => q.source === "ParikshaVerse Authored Bank")).toBe(true);
    });

    it("mock-test session path (call site) cannot introduce fixture questions in production", async () => {
      setEnvironment("production");
      await seedExam(db, neetSeedData);

      // The mock-test repository calls the same guarded choke point; the
      // production guard runs before any insert can happen.
      await questionRepository.ensureFixtureQuestionsSeeded(db);
      await questionRepository.ensureAuthoredQuestionsSeeded(db);

      const rows = await db.select().from(schema.questions);
      expect(rows).toHaveLength(AUTHORED_QUESTIONS.length);
      expect(rows.filter((q) => q.provenance === "fixture")).toHaveLength(0);
    });

    it("staging behavior is unchanged: fixture seeding still works", async () => {
      setEnvironment("staging");
      await seedExam(db, neetSeedData);

      await questionRepository.ensureFixtureQuestionsSeeded(db);

      const fixtures = await db
        .select()
        .from(schema.questions)
        .where(eq(schema.questions.provenance, "fixture"));
      expect(fixtures).toHaveLength(FIXTURE_QUESTIONS.length);
    });

    it("local/development behavior is unchanged: fixture seeding still works", async () => {
      setEnvironment(undefined);
      await seedExam(db, neetSeedData);

      await questionRepository.ensureFixtureQuestionsSeeded(db);

      const fixtures = await db
        .select()
        .from(schema.questions)
        .where(eq(schema.questions.provenance, "fixture"));
      expect(fixtures).toHaveLength(FIXTURE_QUESTIONS.length);
    });

    it("production + canonical question table: normal question reads work", async () => {
      setEnvironment("production");
      await seedExam(db, neetSeedData);
      await questionRepository.ensureAuthoredQuestionsSeeded(db);

      const all = await questionRepository.getAllQuestions(db);
      expect(all).toHaveLength(150);

      const scope = { type: "subject" as const, subjectId: "exam_neet_physics" };
      const physics = await questionRepository.getQuestionsForScope(db, { scope });
      expect(physics).toHaveLength(50);
      expect(physics.every((q) => q.provenance === "authored")).toBe(true);

      const byId = await questionRepository.getQuestionById(db, "q_auth_phy_008");
      expect(byId).not.toBeNull();
      expect(byId?.options).toHaveLength(4);
      expect(byId?.options.filter((o) => o.isCorrect)).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // B. Canonical production seed artifact integrity
  // --------------------------------------------------------------------------
  describe("B. canonical seed contains exactly the approved dataset", () => {
    let d1: D1Database;
    let seededDb: DatabaseInstance;

    beforeEach(async () => {
      d1 = createTestD1Database();
      seededDb = drizzle(d1, { schema });
      await applySeedSql(d1, generateSeedSql());
    });

    it("seeds the canonical NEET catalog (exam, attempt, subjects, chapters, topics)", async () => {
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM exams")).toBe(1);
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM exam_attempts")).toBe(1);
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM subjects")).toBe(3);
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM chapters")).toBe(52);
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM topics")).toBe(139);
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM resources")).toBe(0);

      const attempts = await seededDb.select().from(schema.examAttempts);
      expect(attempts[0].slug).toBe("neet-2027");
      expect(attempts[0].metadata?.syllabusStatus).toBe("provisional");
      expect(String(attempts[0].metadata?.baselineSource)).toContain("U.14023/19/2023-UGMEB");
    });

    it("contains the authored bank ONLY: 150 questions, 600 options, zero fixtures", async () => {
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM questions")).toBe(150);
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM question_options")).toBe(600);

      const rows = await seededDb.select().from(schema.questions);
      expect(rows.every((q) => q.provenance === "authored")).toBe(true);
      expect(rows.every((q) => q.source === "ParikshaVerse Authored Bank")).toBe(true);
      expect(rows.every((q) => q.attribution === "Original practice content")).toBe(true);
      expect(rows.some((q) => q.id.startsWith("q_fix_"))).toBe(false);
      expect(rows.every((q) => q.explanation && q.explanation.length > 0)).toBe(true);
      expect(new Set(rows.map((q) => q.id)).size).toBe(150);

      const subjectCounts = new Map<string, number>();
      for (const q of rows) {
        subjectCounts.set(q.subjectId, (subjectCounts.get(q.subjectId) || 0) + 1);
      }
      expect(subjectCounts.get("exam_neet_physics")).toBe(50);
      expect(subjectCounts.get("exam_neet_chemistry")).toBe(50);
      expect(subjectCounts.get("exam_neet_biology")).toBe(50);

      const difficultyCounts = new Map<string, number>();
      for (const q of rows) {
        difficultyCounts.set(q.difficulty, (difficultyCounts.get(q.difficulty) || 0) + 1);
      }
      expect(difficultyCounts.get("easy")).toBe(49);
      expect(difficultyCounts.get("medium")).toBe(72);
      expect(difficultyCounts.get("hard")).toBe(29);

      const options = await seededDb.select().from(schema.questionOptions);
      expect(new Set(options.map((o) => o.id)).size).toBe(600);
      const perQuestion = new Map<string, { total: number; correct: number }>();
      for (const o of options) {
        const entry = perQuestion.get(o.questionId) || { total: 0, correct: 0 };
        entry.total++;
        if (o.isCorrect) entry.correct++;
        perQuestion.set(o.questionId, entry);
      }
      expect(perQuestion.size).toBe(150);
      for (const [, entry] of perQuestion) {
        expect(entry.total).toBe(4);
        expect(entry.correct).toBe(1);
      }
    });

    it("contains no fixture stems or fixture content", async () => {
      const rawSql = generateSeedSql();
      expect(rawSql).not.toContain("q_fix_");
      expect(rawSql).not.toContain("ParikshaVerse Synthetic Testbank");

      const stems = await seededDb.select({ text: schema.questions.text }).from(schema.questions);
      const fixtureStems = new Set(FIXTURE_QUESTIONS.map((f) => f.text));
      for (const row of stems) {
        expect(fixtureStems.has(row.text)).toBe(false);
      }
    });

    it("establishes valid taxonomy relationships (no orphans, units mapping intact)", async () => {
      // Chapters per subject mirror the official unit mapping:
      // 20 Physics units -> 20 chapters, 20 Chemistry units -> 20 chapters,
      // 10 Biology units -> 12 chapters (Unit 6 decomposed into 3).
      const chapterCounts = await seededDb.all<{ subject_id: string; n: number }>(
        sql.raw(
          `SELECT subject_id, COUNT(*) AS n FROM chapters GROUP BY subject_id ORDER BY subject_id`
        )
      );
      const bySubject = new Map(chapterCounts.map((r) => [r.subject_id, Number(r.n)]));
      expect(bySubject.get("exam_neet_physics")).toBe(20);
      expect(bySubject.get("exam_neet_chemistry")).toBe(20);
      expect(bySubject.get("exam_neet_biology")).toBe(12);

      // Parent relationships: every child resolves to its parent.
      const orphanSubjects = await countRows(
        seededDb,
        "SELECT COUNT(*) AS n FROM subjects s LEFT JOIN exams e ON s.exam_id = e.id WHERE e.id IS NULL"
      );
      const orphanChapters = await countRows(
        seededDb,
        "SELECT COUNT(*) AS n FROM chapters c LEFT JOIN subjects s ON c.subject_id = s.id WHERE s.id IS NULL"
      );
      const orphanTopics = await countRows(
        seededDb,
        "SELECT COUNT(*) AS n FROM topics t LEFT JOIN chapters c ON t.chapter_id = c.id WHERE c.id IS NULL"
      );
      expect(orphanSubjects).toBe(0);
      expect(orphanChapters).toBe(0);
      expect(orphanTopics).toBe(0);

      // Every question points to a fully valid taxonomy path.
      const validQuestions = await countRows(
        seededDb,
        `SELECT COUNT(*) AS n FROM questions q
            INNER JOIN exams e ON q.exam_id = e.id
            INNER JOIN subjects s ON q.subject_id = s.id
            INNER JOIN chapters c ON q.chapter_id = c.id
            INNER JOIN topics t ON q.topic_id = t.id`
      );
      expect(validQuestions).toBe(150);
    });

    it("leaves ZERO user/application data after seeding", async () => {
      const applicationTables = [
        "users",
        "user_workspaces",
        "user_topic_progress",
        "study_sessions",
        "revision_items",
        "planner_tasks",
        "practice_sessions",
        "question_sessions",
        "question_attempts",
        "mock_tests",
        "mock_test_sessions",
        "mock_test_results",
        "user_preferences",
        "notification_preferences",
        "resources",
        "saved_resources",
      ];
      for (const table of applicationTables) {
        expect(await countRows(seededDb, `SELECT COUNT(*) AS n FROM ${table}`)).toBe(0);
      }
    });

    it("is idempotent: a second seed run with fresh timestamps duplicates nothing", async () => {
      // Regenerate the SQL exactly as a second CLI run would (new Date.now()).
      await applySeedSql(d1, generateSeedSql());

      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM exams")).toBe(1);
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM exam_attempts")).toBe(1);
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM subjects")).toBe(3);
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM chapters")).toBe(52);
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM topics")).toBe(139);
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM questions")).toBe(150);
      expect(await countRows(seededDb, "SELECT COUNT(*) AS n FROM question_options")).toBe(600);

      const stems = await seededDb
        .select({ text: schema.questions.text })
        .from(schema.questions);
      expect(new Set(stems.map((s) => s.text)).size).toBe(150);
    });
  });

  // --------------------------------------------------------------------------
  // C. Seed target safety (explicit environment targeting)
  // --------------------------------------------------------------------------
  describe("C. seed runner targets the correct database for each environment", () => {
    it("defaults to the local database only", () => {
      const target = resolveSeedTarget([]);
      expect(target.environment).toBe("local");
      expect(target.databaseName).toBe("pariksha-verse-db-local");
      expect(target.wranglerArgs).toEqual(["--local"]);
    });

    it("targets staging explicitly with --env staging --remote", () => {
      const target = resolveSeedTarget(["--env=staging"]);
      expect(target.environment).toBe("staging");
      expect(target.databaseName).toBe("pariksha-verse-db-staging");
      expect(target.wranglerArgs).toEqual(["--env", "staging", "--remote"]);
    });

    it("targets production only on an explicit production flag", () => {
      const argSets: string[][] = [
        ["--env=production"],
        ["--env=prod"],
        ["--env", "production"],
        ["--env", "prod"],
      ];
      for (const args of argSets) {
        const target = resolveSeedTarget(args);
        expect(target.environment).toBe("production");
        expect(target.databaseName).toBe("pariksha-verse-db-production");
        expect(target.wranglerArgs).toEqual(["--env", "production", "--remote"]);
      }
    });

    it("rejects unknown environments instead of guessing", () => {
      expect(() => resolveSeedTarget(["--env=banana"])).toThrowError(/Unknown seed environment/);
    });

    it("seed targets mirror wrangler.jsonc exactly (local/staging/production isolation)", () => {
      const config = readWranglerConfig();
      const targets = SEED_TARGETS;

      expect(targets.local.databaseName).toBe(config.d1_databases[0].database_name);
      expect(targets.staging.databaseName).toBe(config.env.staging.d1_databases[0].database_name);
      expect(targets.production.databaseName).toBe(
        config.env.production.d1_databases[0].database_name
      );

      expect(config.env.staging.vars.ENVIRONMENT).toBe("staging");
      expect(config.env.production.vars.ENVIRONMENT).toBe("production");

      // Isolation guarantees
      expect(config.env.staging.d1_databases[0].database_id).not.toBe(
        config.env.production.d1_databases[0].database_id
      );
      expect(config.env.staging.d1_databases[0].database_name).not.toBe(
        config.env.production.d1_databases[0].database_name
      );
      expect(config.d1_databases[0].database_name).not.toBe(
        config.env.production.d1_databases[0].database_name
      );
    });
  });
});

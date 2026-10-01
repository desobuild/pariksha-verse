/**
 * Phase 14D Part J — repository-level read verification against an export of
 * the PRODUCTION D1 database. Runs the real Drizzle repositories exactly as
 * the deployed Worker would read them. No deployment, no production user.
 *
 * Run: pnpm exec tsx scripts/verify-production-reads.ts
 */
import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import { drizzle } from "drizzle-orm/d1";
import * as path from "node:path";
import * as schema from "../src/db/schema";
import type { DatabaseInstance } from "../src/db";
import { examRepository } from "../src/repositories/exam.repository";
import { subjectRepository } from "../src/repositories/subject.repository";
import { chapterRepository } from "../src/repositories/chapter.repository";
import { topicRepository } from "../src/repositories/topic.repository";
import {
  questionRepository,
  isFixtureQuestionSeedingAllowed,
} from "../src/repositories/question.repository";
import { getCloudflareEnv } from "../src/lib/cloudflare/env";

const exportPath = path.resolve(process.cwd(), ".tmp-14d/production-export.sqlite");
if (!fs.existsSync(exportPath)) {
  throw new Error(`Production export not found at ${exportPath}`);
}

// Run with the trusted server-side environment marked production, exactly as
// the deployed production Worker sees it (wrangler vars ENVIRONMENT=production).
(globalThis as { __CLOUDFLARE_ENV__?: unknown }).__CLOUDFLARE_ENV__ = {
  ENVIRONMENT: "production",
} as unknown as Record<string, unknown>;

// wrangler d1 export writes an SQL dump (PRAGMAs + DDL + INSERTs) regardless
// of the output extension — load it into an in-memory SQLite database. The
// dump interleaves child rows before their parents (D1 defers FK checks to
// commit), so FK enforcement is disabled for the load itself.
const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys = OFF;");
sqlite.exec(fs.readFileSync(exportPath, "utf-8"));
sqlite.exec("PRAGMA foreign_keys = ON;");
const d1 = {
  prepare(query: string) {
    let bound: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) {
        bound = values;
        return stmt;
      },
      async all<T>() {
        const rows = sqlite.prepare(query).all(...(bound as never[])) as T[];
        return { results: rows, success: true, meta: {} };
      },
      async run() {
        const r = sqlite.prepare(query).run(...(bound as never[]));
        return { success: true, meta: { changes: Number(r.changes) } };
      },
      async first<T>() {
        const rows = sqlite.prepare(query).all(...(bound as never[])) as T[];
        return rows[0] ?? null;
      },
      async raw<T>() {
        const rows = sqlite.prepare(query).all(...(bound as never[])) as Record<string, unknown>[];
        return rows.map((r) => Object.values(r)) as T[];
      },
    };
    return stmt;
  },
  async batch<T>(statements: { all<T2 = T>(): Promise<{ results: T2[] }> }[]) {
    const out = [];
    for (const s of statements) out.push(await s.all<T>());
    return out;
  },
  async exec(query: string) {
    sqlite.exec(query);
    return { count: 1, duration: 0 };
  },
} as unknown as D1Database;

const db: DatabaseInstance = drizzle(d1, { schema });

function assert(cond: boolean, label: string, detail?: string) {
  if (!cond) {
    console.error(`FAIL: ${label}${detail ? ` (${detail})` : ""}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("== Phase 14D Part J: repository-level production reads ==");

  // Environment gate: production-bound repository code path
  assert(
    isFixtureQuestionSeedingAllowed() === false,
    "ENVIRONMENT=production fixture seeding gate is armed"
  );

  // 1. Exam catalog lookup (by slug, as the app does)
  const exam = await examRepository.getExamBySlug(db, "neet");
  assert(exam !== null, "exam catalog lookup by slug 'neet'", exam?.name);
  assert(exam?.id === "exam_neet", "exam id is exam_neet");

  // 2. NEET attempt lookup
  const attempts = await examRepository.getExamAttempts(db, exam!.id);
  assert(attempts.length === 1, "exam attempt lookup", `${attempts.length} attempt(s)`);
  assert(attempts[0]?.slug === "neet-2027", "attempt slug neet-2027", attempts[0]?.label);
  const attemptBySlug = await examRepository.getExamAttemptBySlug(db, exam!.id, "neet-2027");
  assert(attemptBySlug !== null, "attempt lookup by slug");

  // 3. Subject / chapter / topic lookups
  const subjects = await subjectRepository.getSubjectsByExamId(db, exam!.id);
  assert(subjects.length === 3, "subjects for exam", subjects.map((s) => s.slug).join(", "));
  const physics = await subjectRepository.getSubjectBySlug(db, exam!.id, "physics");
  assert(physics !== null, "subject lookup by slug 'physics'");
  const chapters = await chapterRepository.getChaptersBySubjectId(db, physics!.id);
  assert(chapters.length === 20, "physics chapters", `${chapters.length}`);
  const firstChapter = chapters[0];
  const topics = await topicRepository.getTopicsByChapterId(db, firstChapter.id);
  assert(topics.length > 0, "topics for first chapter", `${topics.length} topics`);
  const topicBySlug = await topicRepository.getTopicBySlug(db, firstChapter.id, topics[0].slug);
  assert(topicBySlug !== null, "topic lookup by slug");

  // 4. Question lookup + options
  const all = await questionRepository.getAllQuestions(db);
  assert(all.length === 150, "getAllQuestions returns exactly 150", `${all.length}`);
  assert(
    all.every((q) => q.provenance === "authored"),
    "every question provenance = authored"
  );
  assert(
    all.every((q) => q.options.length === 4 && q.options.filter((o) => o.isCorrect).length === 1),
    "every question has 4 options with exactly 1 correct"
  );

  const byId = await questionRepository.getQuestionById(db, "q_auth_phy_008");
  assert(byId !== null, "question lookup by stable id q_auth_phy_008");
  assert(
    byId !== null &&
      byId.options.length === 4 &&
      byId.options.every((o) => ["A", "B", "C", "D"].includes(o.optionKey)),
    "options load with keys A-D in display order",
    byId?.options.map((o) => o.optionKey).join(",")
  );

  // 5. Question counts by scope (repository path)
  const physicsScope = await questionRepository.countQuestionsForScope(db, {
    scope: { type: "subject", subjectId: "exam_neet_physics" },
  });
  assert(physicsScope === 50, "physics scope count = 50", `${physicsScope}`);
  const chemistryScope = await questionRepository.countQuestionsForScope(db, {
    scope: { type: "subject", subjectId: "exam_neet_chemistry" },
  });
  assert(chemistryScope === 50, "chemistry scope count = 50", `${chemistryScope}`);
  const biologyScope = await questionRepository.countQuestionsForScope(db, {
    scope: { type: "subject", subjectId: "exam_neet_biology" },
  });
  assert(biologyScope === 50, "biology scope count = 50", `${biologyScope}`);

  // 6. Topic-scope read for a represented topic
  const sampleTopicId = all[0].topicId;
  const topicCount = await questionRepository.countQuestionsForScope(db, {
    scope: { type: "topic", topicId: sampleTopicId },
  });
  assert(topicCount > 0, "topic scope read works", `${sampleTopicId}: ${topicCount}`);

  // 7. Zero fixture contamination through repository reads
  assert(
    !all.some((q) => q.id.startsWith("q_fix_") || q.source === "ParikshaVerse Synthetic Testbank"),
    "no fixture questions surfaced through repository reads"
  );

  console.log(process.exitCode ? "== RESULT: FAILURES ==" : "== RESULT: ALL READS PASS ==");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    sqlite.close();
  });

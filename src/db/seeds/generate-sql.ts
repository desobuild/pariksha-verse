import * as fs from "node:fs";
import * as path from "node:path";
import { neetSeedData } from "./data/neet";
import { AUTHORED_QUESTIONS } from "@/data/questions/neet-authored";

function escapeSql(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Date) return String(value.getTime());
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function generateSeedSql(): string {
  const lines: string[] = [
    "-- ==========================================================================",
    "-- ParikshaVerse Deterministic NEET (UG) Seed SQL",
    "-- Baseline Source: NMC UGMEB Public Notice U.14023/19/2023-UGMEB (06.10.2023, NEET-UG 2024)",
    "-- Target Attempt: NEET 2027 (Provisional baseline pending official 2027 release)",
    "-- Idempotent via SQLite INSERT INTO ... ON CONFLICT DO UPDATE/DO NOTHING",
    "-- ==========================================================================",
    "",
  ];

  const now = Date.now();

  // 1. Exam
  const exam = neetSeedData.exam;
  lines.push(
    `INSERT INTO exams (id, slug, name, short_name, description, category, status, metadata, created_at, updated_at) ` +
      `VALUES (${escapeSql(exam.id)}, ${escapeSql(exam.slug)}, ${escapeSql(exam.name)}, ${escapeSql(exam.shortName)}, ${escapeSql(exam.description)}, ${escapeSql(exam.category)}, ${escapeSql(exam.status)}, ${escapeSql(exam.metadata)}, ${now}, ${now}) ` +
      `ON CONFLICT (slug) DO UPDATE SET ` +
      `name = excluded.name, short_name = excluded.short_name, description = excluded.description, ` +
      `category = excluded.category, status = excluded.status, metadata = excluded.metadata, updated_at = ${now};`
  );

  // 2. Attempt
  const attempt = neetSeedData.attempt;
  lines.push(
    `INSERT INTO exam_attempts (id, exam_id, slug, label, exam_date, status, scoring_config, metadata, created_at, updated_at) ` +
      `VALUES (${escapeSql(attempt.id)}, ${escapeSql(exam.id)}, ${escapeSql(attempt.slug)}, ${escapeSql(attempt.label)}, ${escapeSql(attempt.examDate)}, ${escapeSql(attempt.status)}, ${escapeSql(attempt.scoringConfig)}, ${escapeSql(attempt.metadata)}, ${now}, ${now}) ` +
      `ON CONFLICT (exam_id, slug) DO UPDATE SET ` +
      `label = excluded.label, exam_date = excluded.exam_date, status = excluded.status, ` +
      `scoring_config = excluded.scoring_config, metadata = excluded.metadata, updated_at = ${now};`
  );

  // 3. Subjects, Chapters, Topics
  for (const sub of neetSeedData.subjects) {
    const subjectId = `${exam.id}_${sub.slug}`;
    lines.push(
      `INSERT INTO subjects (id, exam_id, slug, name, display_order, created_at, updated_at) ` +
        `VALUES (${escapeSql(subjectId)}, ${escapeSql(exam.id)}, ${escapeSql(sub.slug)}, ${escapeSql(sub.name)}, ${sub.displayOrder}, ${now}, ${now}) ` +
        `ON CONFLICT (exam_id, slug) DO UPDATE SET ` +
        `name = excluded.name, display_order = excluded.display_order, updated_at = ${now};`
    );

    for (const chap of sub.chapters) {
      const chapterId = `${subjectId}_${chap.slug}`;
      lines.push(
        `INSERT INTO chapters (id, subject_id, slug, name, display_order, created_at, updated_at) ` +
          `VALUES (${escapeSql(chapterId)}, ${escapeSql(subjectId)}, ${escapeSql(chap.slug)}, ${escapeSql(chap.name)}, ${chap.displayOrder}, ${now}, ${now}) ` +
          `ON CONFLICT (subject_id, slug) DO UPDATE SET ` +
          `name = excluded.name, display_order = excluded.display_order, updated_at = ${now};`
      );

      for (const top of chap.topics) {
        const topicId = `${chapterId}_${top.slug}`;
        lines.push(
          `INSERT INTO topics (id, chapter_id, slug, name, display_order, created_at, updated_at) ` +
            `VALUES (${escapeSql(topicId)}, ${escapeSql(chapterId)}, ${escapeSql(top.slug)}, ${escapeSql(top.name)}, ${top.displayOrder}, ${now}, ${now}) ` +
            `ON CONFLICT (chapter_id, slug) DO UPDATE SET ` +
            `name = excluded.name, display_order = excluded.display_order, updated_at = ${now};`
        );
      }
    }
  }

  // 4. Authored (production) question bank — original ParikshaVerse content.
  //    Stable IDs + ON CONFLICT DO NOTHING keep repeated seeds idempotent.
  lines.push("", "-- --------------------------------------------------------------------------");
  lines.push("-- Authored Question Bank (provenance = authored, original ParikshaVerse content)");
  lines.push("-- --------------------------------------------------------------------------");

  for (const q of AUTHORED_QUESTIONS) {
    lines.push(
      `INSERT INTO questions (id, exam_id, subject_id, chapter_id, topic_id, text, type, difficulty, explanation, source, source_url, attribution, license, external_id, year, provenance, status, created_at, updated_at) ` +
        `VALUES (${escapeSql(q.id)}, ${escapeSql(q.examId)}, ${escapeSql(q.subjectId)}, ${escapeSql(q.chapterId)}, ${escapeSql(q.topicId)}, ${escapeSql(q.text)}, ${escapeSql(q.type)}, ${escapeSql(q.difficulty)}, ${escapeSql(q.explanation)}, ${escapeSql(q.source)}, ${escapeSql(q.sourceUrl)}, ${escapeSql(q.attribution)}, ${escapeSql(q.license)}, ${escapeSql(q.externalId)}, ${escapeSql(q.year)}, ${escapeSql(q.provenance)}, ${escapeSql(q.status)}, ${escapeSql(q.createdAt)}, ${escapeSql(q.updatedAt)}) ` +
        `ON CONFLICT (id) DO NOTHING;`
    );

    for (const opt of q.options) {
      lines.push(
        `INSERT INTO question_options (id, question_id, display_order, option_key, text, is_correct) ` +
          `VALUES (${escapeSql(opt.id)}, ${escapeSql(opt.questionId)}, ${opt.displayOrder}, ${escapeSql(opt.optionKey)}, ${escapeSql(opt.text)}, ${opt.isCorrect ? 1 : 0}) ` +
          `ON CONFLICT (id) DO NOTHING;`
      );
    }
  }

  return lines.join("\n");
}

if (process.argv[1] && process.argv[1].endsWith("generate-sql.ts")) {
  const sql = generateSeedSql();
  const outputPath = path.resolve(__dirname, "seed-neet.sql");
  fs.writeFileSync(outputPath, sql, "utf-8");
  console.log(`Generated seed SQL at ${outputPath}`);
}

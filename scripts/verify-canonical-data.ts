/**
 * Phase 14D — canonical dataset verification (source-of-truth counts).
 * Run: pnpm exec tsx scripts/verify-canonical-data.ts
 */
import { neetSeedData } from "../src/db/seeds/data/neet";
import { AUTHORED_QUESTIONS } from "../src/data/questions/neet-authored";
import { FIXTURE_QUESTIONS } from "../src/domain/practice-engine/fixtures";

const subjects = neetSeedData.subjects;
let chapterCount = 0;
let topicCount = 0;
const perSubject: Record<string, { chapters: number; topics: number }> = {};
for (const s of subjects) {
  let c = 0;
  let t = 0;
  for (const ch of s.chapters) {
    c++;
    t += ch.topics.length;
  }
  perSubject[s.slug] = { chapters: c, topics: t };
  chapterCount += c;
  topicCount += t;
}

console.log("== Taxonomy (canonical source) ==");
console.log(`subjects: ${subjects.length}`);
for (const [slug, counts] of Object.entries(perSubject)) {
  console.log(`  ${slug}: ${counts.chapters} chapters, ${counts.topics} topics`);
}
console.log(`chapters total: ${chapterCount}`);
console.log(`topics total: ${topicCount}`);

console.log("\n== Authored bank ==");
console.log(`total: ${AUTHORED_QUESTIONS.length}`);
const bySubject: Record<string, number> = {};
const byDifficulty: Record<string, number> = {};
const topicIds = new Map<string, number>();
const chapterIds = new Set<string>();
const ids = new Set<string>();
let duplicateIds = 0;
let missingExplanation = 0;
let badOptions = 0;
for (const q of AUTHORED_QUESTIONS) {
  bySubject[q.subjectId] = (bySubject[q.subjectId] || 0) + 1;
  byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1;
  topicIds.set(q.topicId, (topicIds.get(q.topicId) || 0) + 1);
  chapterIds.add(q.chapterId);
  if (ids.has(q.id)) duplicateIds++;
  ids.add(q.id);
  if (!q.explanation) missingExplanation++;
  const correct = q.options.filter((o) => o.isCorrect).length;
  if (q.options.length !== 4 || correct !== 1) badOptions++;
  if (!q.provenance || q.provenance !== "authored") {
    console.log(`  BAD PROVENANCE: ${q.id} -> ${q.provenance}`);
  }
}
for (const [sid, n] of Object.entries(bySubject)) console.log(`  ${sid}: ${n}`);
for (const [d, n] of Object.entries(byDifficulty)) console.log(`  difficulty ${d}: ${n}`);
console.log(`  distinct topics represented: ${topicIds.size}`);
console.log(`  distinct chapters represented: ${chapterIds.size}`);
const maxPerTopic = Math.max(...topicIds.values());
console.log(`  max questions per topic: ${maxPerTopic}`);
console.log(`  duplicate ids: ${duplicateIds}`);
console.log(`  missing explanation: ${missingExplanation}`);
console.log(`  bad option structure: ${badOptions}`);

const topicsByChapter = new Map<string, Set<string>>();
for (const s of subjects) {
  for (const ch of s.chapters) {
    for (const t of ch.topics) {
      const chapterId = `exam_neet_${s.slug}_${ch.slug}`;
      if (!topicsByChapter.has(chapterId)) topicsByChapter.set(chapterId, new Set());
      topicsByChapter.get(chapterId)!.add(`${chapterId}_${t.slug}`);
    }
  }
}
const perSubjectChapters: Record<string, Set<string>> = {};
const perSubjectTopics: Record<string, Set<string>> = {};
for (const q of AUTHORED_QUESTIONS) {
  const subjectSlug = q.subjectId.replace("exam_neet_", "");
  perSubjectChapters[subjectSlug] ??= new Set();
  perSubjectTopics[subjectSlug] ??= new Set();
  perSubjectChapters[subjectSlug].add(q.chapterId);
  perSubjectTopics[subjectSlug].add(q.topicId);
}
for (const slug of Object.keys(perSubjectChapters)) {
  console.log(
    `  ${slug}: ${perSubjectChapters[slug].size} chapters / ${perSubjectTopics[slug].size} topics represented`
  );
}

const topicSet = new Set([...topicsByChapter.values()].flatMap((s) => [...s]));
const orphans = [...topicIds.keys()].filter((t) => !topicSet.has(t));
console.log(`  orphan topic references: ${orphans.length}${orphans.length ? " -> " + orphans.join(", ") : ""}`);

console.log("\n== Fixture bank (must stay OUT of production) ==");
console.log(`fixture questions: ${FIXTURE_QUESTIONS.length}`);
const fixtureIdPrefixes = new Set(FIXTURE_QUESTIONS.map((q) => q.id.split("_").slice(0, 3).join("_")));
console.log(`fixture id sample: ${FIXTURE_QUESTIONS[0].id} .. ${FIXTURE_QUESTIONS[FIXTURE_QUESTIONS.length - 1].id}`);
const overlap = AUTHORED_QUESTIONS.filter((q) => q.id.startsWith("q_fix_") || q.provenance === "fixture");
console.log(`fixture contamination in authored bank: ${overlap.length}`);

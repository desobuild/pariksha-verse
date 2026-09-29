import { expect, test, type Page, type Response } from "@playwright/test";

/**
 * Shared helpers for the staging QA suite.
 *
 * Staging uses the demo-auth panel (Friend 1–5 + guest) instead of email
 * accounts. All flows here go through the normal UI — no auth bypass, no
 * direct D1 access, no undocumented APIs.
 */

// Demo-panel helpers are implemented once in the shared support module so the
// environment-aware root specs use exactly the same staging auth strategy.
export {
  BRAND_NAME,
  continueAsGuestFromPanel,
  demoSignIn,
  demoSignOut,
  gotoSignInPanel,
} from "../support/auth";

export const STAGING_FRIENDS = [
  "Friend 1",
  "Friend 2",
  "Friend 3",
  "Friend 4",
  "Friend 5",
] as const;
export type StagingFriend = (typeof STAGING_FRIENDS)[number];

// Canonical NEET topics used as isolation probes (stable IDs from the seeded
// syllabus; also referenced by the existing local e2e specs).
export const T_UNITS =
  "exam_neet_physics_physics-and-measurement_units-and-measurements";
export const T_MOTION =
  "exam_neet_physics_kinematics_motion-in-straight-line";
export const TOPIC_UNITS_LABEL = /units of measurement, si units/i;
export const TOPIC_MOTION_LABEL = /frame of reference, uniform & non-uniform motion/i;
export const TOPIC_LEAST_COUNT_LABEL = /least count, significant figures/i;
export const CHAPTER_PHYSICS_AND_MEASUREMENT = /physics and measurement/i;
export const CHAPTER_KINEMATICS = /kinematics/i;

// ---------------------------------------------------------------------------
// Network / runtime health collection
// ---------------------------------------------------------------------------

export type HealthIssue =
  | { kind: "console"; text: string; url?: string }
  | { kind: "pageerror"; text: string }
  | { kind: "requestfailed"; url: string; failure?: string }
  | { kind: "http"; status: number; url: string };

/**
 * HTTP responses that are part of the intended auth design and are therefore
 * not failures: signed-out visitors legitimately receive 401s from protected
 * APIs, and the demo endpoint 404s outside staging.
 */
export function isExpectedHttpIssue(issue: HealthIssue): boolean {
  if (issue.kind !== "http") return false;
  if (issue.status === 401 && issue.url.includes("/api/")) return true;
  if (issue.status === 404 && issue.url.includes("/api/auth/demo")) return true;
  // Cosmetic: favicon probing by the browser.
  if (issue.status === 404 && /\/favicon\.ico($|\?)/.test(issue.url)) return true;
  return false;
}

const RESOURCE_FAILURE_NOISE = [
  // Chromium aborts these when navigation supersedes an in-flight request.
  /net::ERR_ABORTED/i,
];

export function isExpectedRequestFailure(issue: HealthIssue): boolean {
  if (issue.kind !== "requestfailed") return false;
  return RESOURCE_FAILURE_NOISE.some((re) => re.test(issue.failure ?? ""));
}

const CONSOLE_NOISE = [
  // Duplicate of an http issue we already record; adds no signal.
  /^failed to load resource/i,
  // React DevTools suggestion, printed as a log on some builds.
  /download the react devtools/i,
];

export function isExpectedConsoleIssue(issue: HealthIssue): boolean {
  if (issue.kind !== "console") return false;
  return CONSOLE_NOISE.some((re) => re.test(issue.text));
}

export interface HealthCollector {
  issues: HealthIssue[];
  /** Issues that indicate a real problem under the intended auth design. */
  unexpected(): HealthIssue[];
  stop(): HealthIssue[];
}

export function attachHealthCollector(page: Page): HealthCollector {
  const issues: HealthIssue[] = [];

  const onConsole = (msg: { type(): string; text(): string; location(): { url?: string } }) => {
    if (msg.type() !== "error") return;
    issues.push({ kind: "console", text: msg.text(), url: msg.location()?.url });
  };
  const onPageError = (err: Error) => {
    issues.push({ kind: "pageerror", text: String(err) });
  };
  const onRequestFailed = (req: { url(): string; failure(): { errorText: string } | null }) => {
    issues.push({ kind: "requestfailed", url: req.url(), failure: req.failure()?.errorText });
  };
  const onResponse = (res: Response) => {
    if (res.status() >= 400) {
      issues.push({ kind: "http", status: res.status(), url: res.url() });
    }
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);

  return {
    issues,
    unexpected() {
      return issues.filter(
        (i) =>
          !isExpectedHttpIssue(i) &&
          !isExpectedRequestFailure(i) &&
          !isExpectedConsoleIssue(i)
      );
    },
    stop() {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
      return this.unexpected();
    },
  };
}

export function formatIssues(issues: HealthIssue[]): string {
  return issues
    .map((i) => {
      if (i.kind === "console") return `[console] ${i.text}${i.url ? ` (${i.url})` : ""}`;
      if (i.kind === "pageerror") return `[pageerror] ${i.text}`;
      if (i.kind === "requestfailed") return `[requestfailed] ${i.url} ${i.failure ?? ""}`;
      return `[http ${i.status}] ${i.url}`;
    })
    .join("\n");
}

/**
 * Enters guest mode from the landing page ("Get Started") — the standard
 * guest path that does not depend on the staging demo panel being rendered.
 */
export async function continueAsGuestFromLanding(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("link", { name: /get started/i }).click();
  await expect(page).toHaveURL(/\/exam\/select/, { timeout: 20_000 });
}

// ---------------------------------------------------------------------------
// Guest onboarding (same journey as the local specs)
// ---------------------------------------------------------------------------

export async function completeGuestSetup(
  page: Page,
  opts: { goal?: string; stage?: RegExp } = {}
): Promise<void> {
  await page.goto("/exam/select");
  await page.getByRole("radio", { name: /neet/i }).click();
  await page.getByRole("button", { name: /continue with neet 2027/i }).click();
  await expect(page).toHaveURL(/\/exam\/personalize/);
  await page.getByRole("radio", { name: opts.goal ?? "1 hr" }).click();
  await page.getByRole("radio", { name: opts.stage ?? /just starting/i }).click();
  await page.getByRole("button", { name: /create my preparation space/i }).click();
  await expect(page).toHaveURL(/\/app\/home/, { timeout: 20_000 });
}

// ---------------------------------------------------------------------------
// Study / topic status
// ---------------------------------------------------------------------------

function chapterTopicsList(page: Page) {
  return page.locator("ul[id^='chapter-topics-']");
}

/** Expands a chapter on /app/study and opens one of its topics. */
export async function openTopic(page: Page, chapter: RegExp, topic: RegExp): Promise<void> {
  await page.goto("/app/study");
  await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible();
  await page.getByRole("button", { name: chapter }).first().click();
  await chapterTopicsList(page).getByRole("link", { name: topic }).first().click();
  await expect(page).toHaveURL(/\/app\/study\/exam_neet_/, { timeout: 20_000 });
}

/** Marks the topic as Learned via the status menu. Requires the topic detail page. */
export async function markCurrentTopicLearned(page: Page): Promise<void> {
  await page.getByRole("button", { name: /change status/i }).click();
  await page.getByRole("menuitemradio", { name: /^learned/i }).click();
  await expect(page.getByText("Learned").first()).toBeVisible({ timeout: 15_000 });
}

export async function markTopicLearned(
  page: Page,
  chapter: RegExp,
  topic: RegExp
): Promise<void> {
  await openTopic(page, chapter, topic);
  await markCurrentTopicLearned(page);
}

/**
 * Reads the visible status label of a topic on its detail page
 * (e.g. "Not Started", "Learned").
 */
export async function readTopicStatus(
  page: Page,
  chapter: RegExp,
  topic: RegExp
): Promise<string> {
  await openTopic(page, chapter, topic);
  const status = page
    .locator("body")
    .getByText(/^(Not Started|Learning|Learned|Practiced|Revised|Mastered)$/)
    .first();
  await expect(status).toBeVisible();
  return (await status.textContent())?.trim() ?? "";
}

/**
 * Ensures a topic is in the "Not Started" state via the normal UI status
 * menu. Demo profiles on staging are shared and sticky, so specs that need a
 * clean slate must reset their probe topics first.
 */
export async function ensureTopicNotStarted(
  page: Page,
  chapter: RegExp,
  topic: RegExp
): Promise<void> {
  await openTopic(page, chapter, topic);
  const current = await readCurrentStatus(page);
  if (current === "Not Started") return;
  await page.getByRole("button", { name: /change status/i }).click();
  await page.getByRole("menuitemradio", { name: /^not started/i }).click();
  await expect(page.getByText("Not Started").first()).toBeVisible({ timeout: 15_000 });
}

async function readCurrentStatus(page: Page): Promise<string> {
  const status = page
    .locator("body")
    .getByText(/^(Not Started|Learning|Learned|Practiced|Revised|Mastered)$/)
    .first();
  await expect(status).toBeVisible();
  return (await status.textContent())?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// Practice
// ---------------------------------------------------------------------------

/**
 * Runs one question practice session from the Practice hub and submits it.
 * `answered` questions get their first option selected; the rest stay blank.
 * Returns the session result URL.
 */
export async function runPracticeSession(
  page: Page,
  opts: { questionCount?: number; answered?: number; scope?: "mixed" | "topic" } = {}
): Promise<string> {
  const questionCount = opts.questionCount ?? 5;
  const answered = opts.answered ?? questionCount;

  await page.goto("/app/practice");
  await expect(page.getByRole("heading", { name: "Practice & Performance" })).toBeVisible();
  await page.getByRole("button", { name: "Practice Questions" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  if (opts.scope === "topic") {
    await page.locator("#topic-subject-select").selectOption("physics");
    await page.locator("#topic-chapter-select").selectOption("exam_neet_physics_kinematics");
    await page.locator("#topic-topic-select").selectOption(T_MOTION);
  } else {
    await page.getByRole("button", { name: /Mixed \(All\)/i }).click();
  }
  await page.getByRole("button", { name: `${questionCount} Questions` }).click();
  await page.getByRole("button", { name: "Start Practice Session" }).click();

  await expect(page).toHaveURL(/\/app\/practice\/session\/q_sess_/, { timeout: 20_000 });
  await expect(page.getByText(new RegExp(`Question 1 of ${questionCount}`, "i"))).toBeVisible();

  for (let q = 1; q <= questionCount; q++) {
    if (q <= answered) {
      const radios = page.getByRole("radio");
      await expect(radios.first()).toBeVisible();
      await radios.first().click();
    }
    if (q < questionCount) {
      await page.getByRole("button", { name: "Next", exact: true }).click();
      await expect(page.getByText(new RegExp(`Question ${q + 1} of ${questionCount}`, "i"))).toBeVisible();
    }
  }

  await page.getByRole("button", { name: "Review practice session" }).first().click();
  await expect(page.getByText("Practice Session Review")).toBeVisible();
  await page.getByRole("button", { name: "Submit Practice" }).click();

  await expect(page).toHaveURL(/\/app\/practice\/session\/q_sess_.*\/result/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Practice Session Summary" })).toBeVisible();
  return page.url();
}

// ---------------------------------------------------------------------------
// Project scoping
// ---------------------------------------------------------------------------

/** Skips the tests unless the current project matches (used for mobile-only specs). */
export function skipUnlessProject(pattern: RegExp): void {
  test.beforeEach(({}, testInfo) => {
    testInfo.skip(!pattern.test(testInfo.project.name), `Scoped to project matching ${pattern}`);
  });
}

/** Skips the tests when the current project matches. */
export function skipIfProject(pattern: RegExp): void {
  test.beforeEach(({}, testInfo) => {
    testInfo.skip(pattern.test(testInfo.project.name), `Excluded from project matching ${pattern}`);
  });
}

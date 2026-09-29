/**
 * Explicit Playwright target/environment distinction.
 *
 * PLAYWRIGHT_TARGET=local   — local dev server: real email/magic-link auth.
 * PLAYWRIGHT_TARGET=staging — deployed staging: demo auth (Friend 1–5).
 *
 * When PLAYWRIGHT_TARGET is unset, the target falls back to the base URL so
 * the existing staging QA workflow that only sets PLAYWRIGHT_BASE_URL keeps
 * working: an external (non-localhost) base URL is a staging run. An explicit
 * PLAYWRIGHT_TARGET always wins over URL inference.
 */
export type PlaywrightTarget = "local" | "staging";

const EXPLICIT_TARGET = (process.env.PLAYWRIGHT_TARGET ?? "").trim().toLowerCase();

export function isLocalBaseURL(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
}

export function getPlaywrightTarget(): PlaywrightTarget {
  if (EXPLICIT_TARGET === "staging") return "staging";
  if (EXPLICIT_TARGET === "local") return "local";
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.PLAYWRIGHT_TEST_BASE_URL ||
    "http://localhost:3000";
  return isLocalBaseURL(baseURL) ? "local" : "staging";
}

export function isStagingTarget(): boolean {
  return getPlaywrightTarget() === "staging";
}

/**
 * Local/dev is the only environment where the email/magic-link flow (and its
 * sanctioned ENABLE_TEST_AUTH_MOCK test tokens) exists. Staging and production
 * never deliver email and never return test tokens.
 */
export function isLocalAuthEnvironment(): boolean {
  return getPlaywrightTarget() === "local";
}

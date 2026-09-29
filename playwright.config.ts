import { defineConfig, devices, type Project } from "@playwright/test";
import { getPlaywrightTarget, isLocalBaseURL } from "./tests/e2e/support/target";

/**
 * Base URL precedence:
 * 1. PLAYWRIGHT_BASE_URL     — explicit target override (staging QA runs)
 * 2. PLAYWRIGHT_TEST_BASE_URL — original project convention
 * 3. http://localhost:3000    — local dev default
 *
 * When an external (non-localhost) base URL is set, the local webServer is
 * not started and tests run against the provided deployment as-is.
 *
 * The test target (PLAYWRIGHT_TARGET=local|staging, falling back to the base
 * URL) selects the auth strategy the specs use: local runs exercise the real
 * email/magic-link flow, staging runs the demo-auth panel. See
 * tests/e2e/support/target.ts.
 */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
  "http://localhost:3000";
const usesExternalServer = !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(baseURL);
const target = getPlaywrightTarget();

if (target === "local" && !isLocalBaseURL(baseURL)) {
  throw new Error(
    `PLAYWRIGHT_TARGET=local is incompatible with the external base URL ${baseURL}. ` +
      "Email/magic-link auth (and its test tokens) only exists on a locally started dev " +
      "server — use PLAYWRIGHT_TARGET=staging (or leave it unset) for external targets."
  );
}

const projects: Project[] = [
  {
    name: "Desktop Chrome",
    use: { ...devices["Desktop Chrome"] },
  },
  {
    name: "Mobile Chrome (390x844)",
    use: {
      ...devices["Pixel 5"],
      viewport: { width: 390, height: 844 },
    },
  },
];

// Desktop Firefox is opt-in (PLAYWRIGHT_FIREFOX=1) so everyday local runs do
// not require the Firefox binary; cross-browser staging QA sets it explicitly.
if (process.env.PLAYWRIGHT_FIREFOX === "1") {
  projects.push({
    name: "Desktop Firefox",
    use: { ...devices["Desktop Firefox"] },
  });
}

export default defineConfig({
  testDir: "./tests/e2e",
  // The staging specs drive the demo-auth panel, which staging deployments
  // serve exclusively (demo auth fails closed in every other environment), so
  // they are excluded from non-staging runs entirely.
  ...(target === "staging" ? {} : { testIgnore: [/[/\\]e2e[/\\]staging[/\\]/] }),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Staging demo profiles (Friend 1–5) are shared, mutable server-side state:
  // parallel workers let one spec reset a profile while another asserts on it
  // (e.g. user-isolation baseline vs guest-migration). Serial execution is the
  // documented staging workflow for the same reason.
  workers: target === "staging" ? 1 : process.env.CI ? 1 : undefined,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects,
  ...(usesExternalServer
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
          // Local E2E only: lets the email-auth specs complete verification
          // with the sanctioned _testToken (the server-side guard refuses
          // test tokens on staging/production).
          env: { ...process.env, ENABLE_TEST_AUTH_MOCK: "true" },
        },
      }),
});

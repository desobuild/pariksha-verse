# Staging Playwright QA Report

**Date:** 2026-09-29 · **Verdict: NOT PASS — 1 release blocker (staging server-side data layer + demo auth offline)**

## Environment
- URL: https://pariksha-verse-staging.desobuild.workers.dev (via `PLAYWRIGHT_BASE_URL`; no localhost fallback)
- Browsers: Desktop Chrome 141 (Playwright bundled), Mobile Chrome — Pixel 5 device descriptor @ 390×844; Desktop Firefox attempted (not runnable — see Failures #12)
- Viewports: 1280×720 (desktop default), 390×844 (mobile project), plus 375/430/768/1280/1440 loops inside reused viewport suites
- Playwright: 1.63.0 (`@playwright/test`), config: `playwright.config.ts` (extended to accept `PLAYWRIGHT_BASE_URL`, skip the local `webServer` for external targets, `screenshot: only-on-failure`, `trace: retain-on-failure`, opt-in `PLAYWRIGHT_FIREFOX=1` Firefox project)
- New tests: `tests/e2e/staging/` (9 files: helpers, smoke, demo-auth, user-isolation, guest-mode, guest-migration, practice-extended, analytics-extended, mobile-layout, critical-flows). Existing specs reused unmodified. **No application source was changed; no D1 access; nothing deployed.**

## Results

| Suite | Total | Passed | Failed | Skipped |
|---|---|---|---|---|
| New staging suite — Desktop Chrome | 34 | 13 | 8 | 13 |
| New staging suite — Mobile Chrome (390×844) | 34 | 9 | 0 | 25 |
| Existing e2e specs reused vs staging — Desktop Chrome | 61 | 59 | 2 | 0 |
| Critical flows — Desktop Firefox | 2 | 0 | 2 | 0 |
| **Total** | **131** | **81** | **12** | **38** |

All 8 Desktop-Chrome failures and both Firefox failures are explained below; **every staging-suite failure traces to a single release blocker**. Skips are: mobile-only specs on desktop, serial-gated isolation/migration steps after the blocker, and desktop-only specs on the mobile project.

## Critical flows
- **Authentication (demo Friend 1–5): NOT TESTABLE — blocked** (blocker below; the panel never renders).
- **User isolation: NOT TESTABLE — blocked** (release-gate item; must be run after fix).
- **Guest mode: PASS** — enter via landing, NEET 2027 onboarding, topic completion, practice, revision, mock hub, progress; state persists across refresh (IndexedDB); a brand-new context correctly starts empty.
- **Guest → account migration: NOT TESTABLE — blocked** (requires demo sign-in).
- **Study / syllabus: PASS** — full existing suite vs staging (13/13): Exam→Subject→Chapter→Topic hierarchy, Physics/Chemistry/Biology, chapter expansion, topic status changes, refresh persistence, search/filters, direct URL navigation.
- **Practice: PASS** — existing suites plus new extended tests: 10-question mixed session with Previous-navigation and answer changes, topic clamping (2-question topic; dialog reports "2 questions available in bank"), per-topic session logging verified against the Performance Snapshot aggregate (10/10, 3/3), explanations rendered on review.
- **Revision: PASS (guest scope)** — due/overdue/upcoming/recently-revised render from real data, completion reschedules (+3 days), filters, dashboard CTAs.
- **Mock: PASS** — full flow (instructions, timer, answer, mark-for-review, palette jump, submit modal, result, section performance, QbQ review, history) and mid-mock reload persistence.
- **Analytics: PASS (guest scope)** — live activity reflected in all four time ranges (7/30/90/All), coverage, weak topics (<60%), study time, neutral no-prediction-language guarantee.
- **Mobile: PASS (emulation)** — 9/9 on 390×844: no horizontal overflow, no nested scroll containers, bottom-most content clears the fixed nav after full scroll, nav usable from scrolled state, session screens hide nav by design, CTAs/disclaimers unclipped. **This does not replace the physical Pixel 10 test.**

## Failures
1–7. `smoke /auth/sign-in`, `demo-auth` ×4, `user-isolation baseline`, `guest-migration migrate`, `critical-flows demo` — all fail at the same gate: **"Pick a demo profile" never renders**. URL: https://pariksha-verse-staging.desobuild.workers.dev/auth/sign-in · Browser: Desktop Chrome · Viewport 1280×720 · Evidence: `test-results\**` (screenshots + traces per test). No console/network errors beyond the blocker itself.
8. `dashboard.spec.ts "2. Today's Focus and empty state…"` — fresh guest workspace shows mock-catalog entries in Recent Activity instead of the empty state (see Non-blocking #1). Desktop Chrome. Screenshot+trace in `test-results\staging-*-Desktop-Chrome`.
9. `auth-flows.spec.ts "Flow 5"` — email account creation is unavailable on staging (page stays on /auth/create-account). Expected for the demo deployment, listed for completeness.
10–11. `POST /api/auth/sign-in` probe → **HTTP 500** `{"error":"Failed to process sign in request."}`; `GET /api/health` → `{"environment":"development","database":{"d1Configured":false}}` (part of blocker evidence).
12. Desktop Firefox (both critical-flow tests) — `browserType.launch`: Playwright Firefox 155 build exits immediately (exit 255; `gkcodecs.dll`/`mozavutil.dll` fail host validation on this machine). QA-environment limitation, not a product defect.

## Release blockers
**B1 — The deployed staging Worker cannot see its own configuration or database.** `getCloudflareEnv()` (`src/lib/cloudflare/env.ts`) reads `globalThis.__CLOUDFLARE_ENV__`, which nothing assigns in the built worker, then falls back to `process.env`, which does not carry wrangler vars/bindings in the production runtime. Observed on the deployed staging:
- `GET /api/health` → `environment: "development"`, `d1Configured: false` (deployed via `env.staging` where `ENVIRONMENT=staging` is set);
- `GET /api/auth/session` → `demoAuth: {"enabled":false,"options":[]}`; `POST /api/auth/demo` → 404 (fails closed by design when ENVIRONMENT ≠ "staging");
- `POST /api/auth/sign-in` → **500** (D1 write unreachable);
- `/auth/sign-in` renders the email form — the Friend 1–5 panel never appears.
Consequences: demo authentication (Friend 1–5) is unavailable, every server-backed feature (session sync, workspaces, server practice/revision/mock history, migration) is non-functional, and **user isolation could not be verified at all**. The deployed build corresponds to the uncommitted working tree (the demo-auth module is present; its env gate can never open). Fix: assign the Workers `env` to `globalThis.__CLOUDFLARE_ENV__` in the vinext worker entry chain (or read env via `cloudflare:workers`), redeploy staging, then re-run `tests/e2e/staging` (demo-auth, user-isolation, guest-migration are already written and will exercise the full path).

## Non-blocking issues
1. **Recent Activity shows phantom mock activity for a brand-new workspace** — `compileRecentActivity` (`src/domain/dashboard.ts:708`) iterates `context.mockTests` (the available-mock catalog, e.g. bundled "Sample Practice Mock (ParikshaVerse Original)", "3 days ago") as if they were completed results. Misleading for new users; also makes the old `dashboard.spec` test-2 empty-state expectation permanently unfulfillable (needs a product decision + test update).
2. Grammar: "Studied on **1 days** in total." (Progress page, All-time window).
3. Grammar: "**1 questions**" in Recent Practice rows (singular count).
4. The email-auth e2e specs (auth-flows, onboarding Flows 3/6, revision 11–12, analytics 7, dashboard 5) are structurally incompatible with the staging demo-auth design; they need an environment-conditional strategy rather than being runnable everywhere.
5. Mixed practice logs one practice-session row per topic by design (`src/repositories/guest-repositories.ts` submitSession) — verify this is the intended UX, since a 10-question mixed session reads as "10 sessions logged".

## Recommendation
**The automated staging suite did NOT pass: 81/131 executed tests passed, and every failure traces to one deployment-level release blocker (B1).** Guest-mode, study, practice, mock, revision, analytics, and mobile-emulation checks are green — the client-side product is healthy on staging. But the staging deployment itself is effectively client-only right now: demo auth is dead and the server data layer 500s.

Before release:
1. Fix the Workers env wiring (B1), redeploy staging, and re-run `set PLAYWRIGHT_BASE_URL=… && npx playwright test tests/e2e/staging --project="Desktop Chrome" --workers=1`.
2. **User isolation (Phase 4) and guest→account migration (Phase 6) remain unverified and are mandatory gates** — the specs are ready and will cover them once demo auth is live.
3. Resolve the Recent Activity phantom-mock issue (#1) and decide on the per-topic session logging UX (#5).
4. Keep the physical Pixel 10 test as the final mobile confirmation — emulation covers layout/overflow/scroll contracts but not real touch, safe-area, or IME behavior. Firefox critical flows need a machine/CI where the Playwright Firefox build runs.

Artifacts: failure screenshots + traces under `test-results\`, this report at `STAGING-QA-REPORT.md`.

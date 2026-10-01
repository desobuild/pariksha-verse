# ParikshaVerse — Phase 14 Production Readiness Audit

**Date:** 2026-09-29 · **Repository:** https://github.com/desobuild/pariksha-verse · **main:** `eb754db` (matches GitHub)
**Mode:** READ-ONLY AUDIT — no source, config, lockfile, or dependency changes; no Cloudflare resources created; no commits/pushes. This file is new and untracked.

---

## 1. Executive summary

ParikshaVerse is **not ready for production deployment**. The application core is in good shape (staging validated: unit 474/474, TS/ESLint clean, builds green, 142 local + 169 staging Playwright checks passing per the stated Phase-13 results), but the audit found **five hard blockers** and a set of pre-launch requirements:

1. **Critical RCE in the production runtime dependency.** `react-server-dom-webpack@19.0.0` (pinned in `package.json:52` and dragged in via `vinext > @vitejs/plugin-rsc`) is affected by CVE-2025-55182 / GHSA-fv66-9v8q-g76r — unauthenticated RCE in the RSC flight protocol, CVSS 10.0, EPSS 99.8%. This package is the actual deserializer in the deployed Worker (vinext runtime), so the exposure is real, not theoretical.
2. **`next@15.2.0` is flagged by the current advisory set** — 3 critical + 14 high/moderate advisories apply to the exact version (including two more criticals patched only in ≥15.5.24). `pnpm audit` reports **52 advisories total: 5 critical, 22 high, 22 moderate, 3 low**. Upgrading within Next 15 (→ 15.5.26) clears everything; Next 16 is **not** required.
3. **The magic-link verification page does not exist.** The email links to `/auth/verify?token=…`, but `src/app/auth/` contains only `create-account` and `sign-in`, with no rewrites and no middleware — clicking the email button 404s. Only the manual "paste the token into the sign-in form" fallback works. The primary production auth flow is broken.
4. **Production infrastructure does not exist**: production D1 is a placeholder (`REPLACE_WITH_PRODUCTION_D1_DATABASE_ID`, `wrangler.jsonc:62`), and production secrets (`SESSION_SECRET`, `RESEND_API_KEY`) are not provisioned. Both fail closed (deploy fails / auth 500s), so nothing silent ships — but nothing works either.
5. **Email cannot be delivered yet**: Resend sending domain (`auth@parikshaverse.in`) requires domain verification/DNS before any sign-in works in production.

Additionally, **rate limiting, token-replay protection, server-side session revocation, security headers, and one confirmed cross-tenant write gap** (guest migration) are required before public launch (P1). The auth hardening items deferred from the staging audit are all still open, plus two new findings (missing verify page; migration mock-result fallback).

Recommended sequence: **14A dependency/security upgrade → 14B auth completion & hardening → 14C production infrastructure → 14D production data → 14E email → 14F headers/edge → 14G observability/ops → 14H smoke tests & deploy.** No architecture change is required anywhere: the dependency fix is a pin bump, the auth fix is one page plus hardening modules.

---

## 2. Current architecture

**Stack:** Next.js 15.2.0 App Router (React 19.3.0) → built with **vinext 1.0.0-beta.11** (Cloudflare's Vite-based reimplementation of the Next.js API surface) + `@cloudflare/vite-plugin` 1.60.2 + `@vitejs/plugin-rsc` 0.5.34 + Vite 8.3.0 → deployed as a **Cloudflare Worker** with D1.

| Aspect | Value | Evidence |
|---|---|---|
| Production runtime | vinext fetch-handler on Workers (the Next.js Node server does **not** run in production) | `wrangler.jsonc:12` (`main: "vinext/server/fetch-handler"`), wrangler.jsonc:8-11 comment |
| Worker names | `pariksha-verse` (top-level/dev), `pariksha-verse-staging`, `pariksha-verse-production` | wrangler.jsonc:3,40,57 |
| D1 binding | `DB` in all envs; staging `pariksha-verse-db-staging` (real id); production `pariksha-verse-db-production` (placeholder id) | wrangler.jsonc:21-28,41-47,58-64 |
| Other bindings | `ASSETS` (static assets fallback) | wrangler.jsonc:16-20 |
| Compat | `compatibility_date 2025-02-14`, `nodejs_compat` | wrangler.jsonc:4-7 |
| Env detection | `cloudflare:workers` runtime module → `globalThis.__CLOUDFLARE_ENV__` → `process.env` fallback (default `development`) | `src/lib/cloudflare/env.ts:41-51,80-108`; warm-up in `src/instrumentation.ts:15-18` (fixed in `0aa73ac`) |
| Deploy commands | `cf:deploy:staging` → `vinext-cloudflare deploy --env staging` → `wrangler deploy --env staging`; same for `--env production` | package.json:15-16, `node_modules/@vinext/cloudflare/dist/deploy.js:213-233,301-306` |
| Local dev | `next dev` + node:sqlite shim (`src/db/local-d1.ts`) or `vinext:dev` (workerd/miniflare) | package.json:7,10; `src/db/index.ts:19-43` |
| Staging URL | `https://pariksha-verse-staging.desobuild.workers.dev` | STAGING-QA-REPORT.md:6 |
| Production URL | **unconfigured** — no `routes`/`custom_domains` in the production env block | wrangler.jsonc:56-72 |
| Observability | `observability.enabled` at top level, inherited by staging/production | wrangler.jsonc:35-37 |

The `next` package is used at runtime only for client components (`next/link`, `next/image` — one file, `src/components/shared/brand-mark.tsx`) and route-handler helpers (`next/server`); the server runtime is vinext's.

---

## 3. Dependency / security findings

`pnpm audit` (pnpm 11.28.0, registry state as of 2026-09-29): **52 advisories — 5 critical, 22 high, 22 moderate, 3 low**, against 926 total dependencies (149 prod / 635 dev).

### 3.1 Critical advisories affecting this exact dependency set

| Package | Installed | Advisory | Severity | Patched |
|---|---|---|---|---|
| react-server-dom-webpack | **19.0.0** (pinned) | GHSA-fv66-9v8q-g76r / **CVE-2025-55182** ("React2Shell") — unauthenticated RCE via RSC payload deserialization; CVSS 10.0; EPSS 99.8%; disclosed 2025-12-03 | critical | **19.0.1 / 19.1.2 / 19.2.1** (line releases) |
| next | 15.2.0 | GHSA-9qr9-h5gf-34mp — RCE in React flight protocol | critical | ≥15.2.8 |
| next | 15.2.0 | GHSA-f82v-jwr5-mffw — authorization bypass in middleware | critical | ≥15.2.8 (N/A here: no middleware exists) |
| next | 15.2.0 | GHSA-p293-qw3h-jr36 — unauthenticated RCE on Windows-hosted servers | critical | ≥15.5.24 (N/A on Workers runtime) |
| next | 15.2.0 | GHSA-2xp9-vwfh-vxw4 — unauthenticated RCE in image optimization (AVIF) | critical | ≥15.5.24 |

High-severity highlights: 13 further `next` DoS/SSRF/bypass advisories (patch floors 15.2.8, 15.2.9, 15.5.15, 15.5.16, 15.5.18, 15.5.21, 15.5.24); **`drizzle-orm@0.39.3` < 0.45.2 (GHSA-gpj5-g38j-94v9, SQL injection via improperly escaped identifiers — production runtime dependency)**; `sharp` libvips CVEs (build-time, via next). Moderate/low: postcss (build-time), esbuild (dev), vitest (dev), undici (dev, via miniflare/wrangler).

**Exposure nuance:** the `next` server-side advisories mostly target the Node Next.js server, which does not run in production (vinext reimplements the runtime; no middleware; `next/image` used in one client component). The genuinely live production exposure is **react-server-dom-webpack 19.0.0** — it deserializes untrusted RSC/action payloads in the deployed Worker. The remaining findings still block a clean audit gate and defense-in-depth.

### 3.2 Why the old versions are pinned despite newer vinext

`react-server-dom-webpack@19.0.0` is an **exact direct pin** (`package.json:52`) that overrides whatever vinext would resolve. The installed vinext betas tolerate it; **vinext 1.0.0 stable peer-requires `react-server-dom-webpack ^19.2.6`** (npm peerDependencies), which is the RCE-patched line.

### 3.3 Dependency upgrade recommendation (do not execute yet — separate implementation phase 14A)

| Package | From | To | Why |
|---|---|---|---|
| react-server-dom-webpack | 19.0.0 (exact) | **^19.2.8** (latest stable = 19.2.8; satisfies vinext peer ^19.2.6, ≥ 19.2.1 RCE patch) | clears CVE-2025-55182 + 5 RSC DoS/source-exposure advisories |
| vinext | 1.0.0-beta.11 | **1.0.0** | stable; peers align with installed vite 8.3.0 / react 19.3.0 / plugin-rsc 0.5.34 / plugin-react 6.1.1 |
| @vinext/cloudflare | 1.0.0-beta.9 | **1.0.0** | pairs with vinext 1.0.0 (peer `vinext ^1.0.0`) |
| next | 15.2.0 (exact) | **15.5.26** (npm `backport` dist-tag; latest 15.x; ≥15.5.24 covers all criticals) | clears all 24 next advisories |
| eslint-config-next | 15.2.0 | **15.5.26** | keep in lockstep with next |
| drizzle-orm | 0.39.3 | **≥0.45.2** | GHSA-gpj5-g38j-94v9 (SQLi via identifiers) |
| drizzle-kit | 0.30.6 | latest compatible | pairing with drizzle-orm |
| react / react-dom | 19.3.0 | no change (satisfies ^19.2.6) | — |
| vite / @vitejs/plugin-rsc / @vitejs/plugin-react / @cloudflare/vite-plugin | current | no change required | — |
| vitest, esbuild, postcss, sharp, undici (dev/build chain) | current | opportunistic bump | dev-time only, P2/P3 |

**Answers to the posed questions:**
1. Next.js 15.2.0 is currently affected — by 3 critical + 14 high/moderate current advisories (not just CVE-2025-66478).
2. The React/RSC stack is affected at `react-server-dom-webpack@19.0.0` (critical RCE); React itself (19.3.0) is current and unaffected.
3. Yes — two additional Next criticals (≥15.5.24 patches) and a runtime high on drizzle-orm exist beyond the 2025 advisory.
4. Recommended patches: RSDW ≥19.2.1 (use 19.2.8), next ≥15.5.24 (use 15.5.26), drizzle-orm ≥0.45.2.
5. **Yes, upgrading within Next 15 is sufficient** — 15.5.26 is the final 15.x line and receives security backports.
6. **Next 16 is not necessary for security.** It is advisable strategically: Next 15 is maintenance-only and hits end-of-life **2026-10-21** (~3 weeks out). Treat the Next 16 move as a post-launch phase (P2) after vinext's Next-16-surface compatibility is validated — vinext reimplements the API surface, so the app must be re-tested, but no Cloudflare re-architecture is implied. (Alternative path, if vinext ever blocks: OpenNext's Cloudflare adapter supports Next 15.5/16.)
7. vinext/Cloudflare does **not** constrain the security upgrade: vinext 1.0.0's peers are satisfied by every other installed version; only RSDW must move.
8. **Yes — the upgrade requires no application-architecture change** (same Vite/vinext/plugin-rsc stack, same React major). Verification gates: `pnpm audit` clean (prod), typecheck, 474 unit tests, full local Playwright suite, staging redeploy + staging e2e.

---

## 4. Cloudflare production architecture

**Intended production architecture** (all in `wrangler.jsonc:56-72`):

- **Worker:** `pariksha-verse-production`
- **D1:** `pariksha-verse-db-production`, binding `DB` — **current status: placeholder** (`database_id: "REPLACE_WITH_PRODUCTION_D1_DATABASE_ID"`, wrangler.jsonc:62); the database has never been created
- **Bindings:** `DB` (D1), `ASSETS` (static assets)
- **Vars:** `ENVIRONMENT=production`, `ENABLE_TEST_AUTH_MOCK=false`, `NEXT_PUBLIC_APP_URL=https://parikshaverse.in`, `EMAIL_FROM=ParikshaVerse <auth@parikshaverse.in>`
- **Secrets required (none provisioned):** `SESSION_SECRET`, `RESEND_API_KEY` — via `wrangler secret put <name> --env production` (Cloudflare secrets are env-scoped; staging and production are set separately)
- **Build/deploy:** `pnpm cf:build` (vinext build) → `pnpm cf:deploy:prod` (`vinext-cloudflare deploy --env production` → `wrangler deploy --env production`)

**Separation verification:**

| Check | Status | Evidence |
|---|---|---|
| Staging/production separated | ✅ Separate worker names; `production` env block fully redefines `d1_databases` | wrangler.jsonc:40,57,58-64 |
| Staging D1 usable by production | ✅ Not via config — cross-wiring would require manually pasting the staging UUID into the prod block | wrangler.jsonc:58-64 |
| Demo auth cannot enable in production | ✅ `isStagingDemoAuthEnabled()` requires trusted server-side `ENVIRONMENT === "staging"` exactly; **fails closed** (default `""`); route returns 404 otherwise | demo/route.ts:29-33; staging-demo-auth.ts:73-82,89-107 |
| `ENABLE_TEST_AUTH_MOCK` in production | ✅ Double-gated: `!isStagingOrProd && (… === "true")` (strict string compare); wrangler pins `"false"`; unit tests assert staging/prod reject even when `"true"` | sign-in/route.ts:44-48; create-account/route.ts:37-41; tests/unit/staging-deployment.test.ts:192-247 |
| Local values leaking to production | ✅ No localhost literals in `src/`; `NEXT_PUBLIC_APP_URL` is a runtime wrangler var per env, not build-inlined; no build-machine env dependency | wrangler.jsonc:32,52,69; sign-in/route.ts:55 |
| Vercel dependency | ✅ None — two defensive `VERCEL_ENV` reads only (strict-secret trigger; demo-auth disable) | crypto-session.ts:57; staging-demo-auth.ts:101 |
| Runtime bindings resolved correctly | ✅ via `cloudflare:workers` (fixed in `0aa73ac`) + instrumentation warm-up; client-bundle guard | env.ts:41-99; instrumentation.ts:15-18 |

**Deploy-path risks found:**

1. **[P0]** Production D1 placeholder → `wrangler deploy --env production` and `db:migrate:prod` fail until a real database is created and the UUID inserted (wrangler.jsonc:62).
2. **[P0]** Secrets not provisioned and undocumented — missing `SESSION_SECRET` throws on every token operation (crypto-session.ts:60-77); missing `RESEND_API_KEY` makes sign-in/create-account hard-500 (email-service.ts:184-194). No doc describes per-env `wrangler secret put` (README.md:134-151 is silent; no DEPLOYMENT doc exists).
3. **[P1]** No `routes`/`custom_domains` for production — it would be reachable only at `pariksha-verse-production.<account>.workers.dev`; `parikshaverse.in` wiring is an unmade external decision.
4. **[P2]** `pnpm vinext:deploy` (no `--env`) deploys the **dev-config top-level worker** (`ENVIRONMENT=development`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, fake D1 id — wrangler.jsonc:24-34); `cf:preview` maps to an undefined `"preview"` wrangler env (deploy.js:303). Wrong-environment footguns.
5. **[P2]** `.gitignore` excludes `.env`/`.env*.local` but **not `.dev.vars`** — a future `.dev.vars` with secrets would be committable (.gitignore:36-39; no `.dev.vars` exists today).
6. **[P1 verification]** The deployed staging worker was built from the pre-`0aa73ac` tree (STAGING-QA-REPORT.md B1: health reported `development`/`d1Configured:false`, sign-in 500). The stated Phase-13 re-validation (93+76 passing) implies a redeploy — confirm the live staging Worker is built from `eb754db` and `GET /api/health` reports `environment:"staging"` before treating staging as the production dress rehearsal.
7. **[P3]** `/api/health` discloses `environment` + `d1Configured` publicly and never queries D1, so a broken DB still reports healthy (health/route.ts:7,15).
8. **[P3]** `worker-configuration.d.ts:5` types `ENABLE_TEST_AUTH_MOCK` as literal `"false"` (top-level vars), so typecheck cannot catch a per-env flip.

---

## 5. Database readiness

**Migrations (`src/db/migrations/`, applied in filename order — all five required, all pure DDL, all D1-compatible):**

| File | Contents |
|---|---|
| `0000_panoramic_mac_gargan.sql` | `health_check` table |
| `0001_milky_kate_bishop.sql:1-277` | all core tables (exams, subjects, chapters, topics, users, user_workspaces, progress, planner, study_sessions, revision, practice, resources, mock_tests, mock_test_results, preferences) + indexes/FKs |
| `0002_empty_payback.sql` | `user_preferences.preparation_stage` |
| `0003_question_bank.sql:1-72` | `questions` (provenance/license/source columns; default `'fixture'`), `question_options`, `question_sessions`, `question_attempts` |
| `0004_mock_exam_simulation.sql:1-35` | mock-test columns, `mock_test_sessions`, mock-result columns |

- **0000–0004 are sufficient** for production; **no local-only migrations exist** (no INSERTs anywhere; zero fixture/demo/user rows in any migration SQL).
- **From-scratch initialization is safe** — parent-first seed order, no PRAGMAs, FK forward-reference inside 0001 (`:226` before `:243`) resolves within the file.
- **Drizzle meta drift:** `meta/_journal.json` and snapshots stop at 0002; migrations 0003/0004 were hand-written without meta updates. Schema and SQL do match (verified column-by-column), but **running `pnpm db:generate` today would re-emit 0003/0004 content as a duplicate migration** — regenerate snapshots before any future `db:generate` (P2).

**Seed / canonical production data:**
- `src/db/seeds/run.ts` generates `src/db/seeds/seed-neet.sql` (committed, 338 KB) and shells out to wrangler — **but targets database name `pariksha-verse-db` (wrong; local is `pariksha-verse-db-local`) and is hardwired `--local`** (run.ts:15), so `pnpm db:seed` is currently broken and production has no seed script path (P1).
- Seed contents: 1 exam (`exam_neet`), 1 exam attempt, 3 subjects, 52 chapters, 139 topics, **150 authored questions**, 600 options, **0 users / 0 workspaces / 0 mock_tests** — verified by literal counts of the committed SQL.
- **Idempotent:** exams/subjects/chapters/topics upsert (`ON CONFLICT … DO UPDATE`, generate-sql.ts:33-72); questions/options `ON CONFLICT (id) DO NOTHING` (:89,96). Safe to run twice.
- **Question provenance is production-safe:** 150 original authored questions in `src/data/questions/{physics,chemistry,biology}.ts`, `provenance:"authored"`, `source:"ParikshaVerse Authored Bank"`, explicit no-PYQ/no-copyright policy (authored-types.ts:5-18); validation blocks fixture-ID collisions (validation.ts:268-275); sampled content is clean (no placeholders/PII). A runtime self-heal also inserts missing authored questions (`question.repository.ts:57-72`). NEET-2027 taxonomy is marked provisional pending the official NTA/NMC syllabus (docs/exam-data.md:34-38) — documented content risk.
- **Fixture-injection risk (P1):** `ensureFixtureQuestionsSeeded()` (`question.repository.ts:42-49`) inserts the **120 synthetic test fixtures (`q_fix_*`, `provenance:"fixture"`)** whenever the `questions` table is **empty**, and it runs on live paths (`getAllQuestions` :153, `createSession` :245, `mock-test.repository.ts:234`). If production goes to traffic unseeded, fixtures enter prod on the first practice request. **Mitigation: seed production before traffic (hard gate); add an env guard to the fixture path (P2).**
- Fake users/demo accounts cannot enter production via migrations or seed; demo identities (`usr_demo_staging_*`, `.invalid` emails) are staging-route-gated only (staging-demo-auth.ts:33-64,131-156).

**PII tables:** `users` (email — the only direct PII), user_workspaces, user_topic_progress (+free-text `notes`), planner_tasks, study_sessions, revision_items, practice_sessions, mock_tests (+`notes`), mock_test_results, preferences (incl. timezone). Content tables: exams/subjects/chapters/topics/questions/resources.

---

## 6. Authentication readiness

**Production flow (as implemented):** email → `POST /api/auth/sign-in|create-account` (zod email validation; sign-in 404s unknown users, create-account upserts `usr_<uuid>`) → `createMagicLinkToken` = **HMAC-SHA256** compact token `{email, purpose:"magic_link", iat, exp:+15min}` (crypto-session.ts:221-233) → Resend email with link `${NEXT_PUBLIC_APP_URL}/auth/verify?token=…&email=…` (create-account/route.ts:50,81; sign-in/route.ts:56) → `POST /api/auth/verify` (zod; verifies signature+expiry+email, verify/route.ts:27-30) → **auto-creates user if missing** (41-51) → 30-day session token → `pv_session` cookie → client auto-runs guest migration → `/app/home`.

**P0 finding — the verify page does not exist.** `src/app/auth/` contains only `create-account/` and `sign-in/` (directory-verified); `next.config.ts:1-9` has no rewrites; there is no middleware or catch-all. The email's sign-in button lands on a **404**. The only working path is manually copy-pasting the raw token (which the email prints in plaintext, email-service.ts:57-60) into the sign-in form's "Verification Code / Token" input (sign-in/page.tsx:142-153). Production auth is broken on the primary path, and no e2e suite ever exercised the email flow on staging (staging uses demo auth; STAGING-QA-REPORT.md failure #9).

| Auth check | Status | Evidence |
|---|---|---|
| Magic-link token returned in production responses | ✅ No — `_testToken` only when `!staging/prod && ENABLE_TEST_AUTH_MOCK==="true"` | create-account/route.ts:63-65,94-96; sign-in/route.ts:77-79 |
| `_testToken` fail-closed | ⚠️ P2 — logic defaults env to `"development"` when `ENVIRONMENT` unset, so mock is fail-open on a misconfigured deployment without `ENVIRONMENT`; prod pins the var, so not reachable as configured | create-account/route.ts:37-41 |
| Demo auth outside staging | ✅ 404, fails closed, fixed server-side roster, `.invalid` emails, strict zod | demo/route.ts:29-33; staging-demo-auth.ts:89-107 |
| SESSION_SECRET required | ✅ Throws if missing / equal to known dev default / <32 chars in staging-prod; no fallback anywhere | crypto-session.ts:23-24,60-77,84-86 |
| Cookie Secure in production | ✅ Forced when env is staging/production (plus https/x-forwarded-proto detection); relaxed only for localhost http | session.ts:33-129,140 |
| HttpOnly / SameSite / expiry | ✅ `HttpOnly; SameSite=Lax; Max-Age=2592000` (30 days, fixed — no sliding renewal) | session.ts:134-141 |
| Token expiry enforced | ✅ 15 min, checked at verify | crypto-session.ts:187-192,230 |
| Token replay | ❌ **P1** — stateless tokens, no consumption record; each replay within 15 min mints a fresh 30-day session; token is deterministic (no nonce) | verify/route.ts:27-67; no token table in src/db/schema |
| Session revocation | ❌ **P1** — no sessions table; sign-out only clears the cookie; a stolen cookie is valid 30 days unless `SESSION_SECRET` is rotated (invalidates everyone) | sign-out/route.ts:4-10; session.ts:146-152 |
| Account enumeration | ⚠️ **P2** — sign-in: 404 vs 200 (different timing); create-account: 200 vs 201 with different messages | sign-in/route.ts:35-40,72-81; create-account/route.ts:59-66,90-98 |
| Rate limiting | ❌ **P1 — none anywhere** (src-wide search; no dependency) | — |
| Email failure handling | ⚠️ P2 — fail-closed 500 when provider unconfigured (token discarded, no leak); create-account inserts the user row **before** sending, orphaning accounts on send failure; no timeout/retry on the Resend fetch | email-service.ts:38-68,184-194; create-account/route.ts:70-88 |
| Email provider required in prod | ✅ Fail-closed stub → hard 500 until `RESEND_API_KEY` set | email-service.ts:184-194 |
| CSRF posture | ⚠️ Acceptable baseline: SameSite=Lax + JSON-only bodies; no Origin/Referer checks, no CSRF tokens (P2) | session.ts:140 |
| Session validation | ✅ Fail-closed: signature+exp+D1 user lookup; DB error → null → 401 | session.ts:159-204 |
| Token/email in URL query | ⚠️ P2 — leaks to history/logs/Referer; `purpose` claim never validated (P3) | create-account/route.ts:50,81; verify/route.ts:27-30; crypto-session.ts:16 |
| Client-side token storage | ✅ None — HttpOnly cookie only; guest data in IndexedDB/localStorage is PII-free | auth-context.tsx:47-78; guest-identity.ts:22-27 |

**Deferred hardening items from the staging audit — all still open, none implemented:** rate limiting; one-time token replay protection; server-side session revocation; account enumeration; security headers. Confirmed in sections 6/10 below; implementation is phase 14B/14F.

---

## 7. Email readiness

- Provider: Resend, plain `fetch("https://api.resend.com/emails")`, single attempt, **no timeout/AbortController, no retry** (email-service.ts:38-68).
- Templates: subject "Your ParikshaVerse Sign-In Link"; HTML card with sign-in button (links `${verificationUrl}`) **plus the raw token printed in plaintext in the body** (lines 57-60); "expires in 15 minutes" copy (62-64).
- Local dev uses a console provider (`NODE_ENV !== "production"`, lines 124-135); staging/production fail closed without `RESEND_API_KEY` (184-194).
- Sender addresses (wrangler vars): staging `ParikshaVerse Staging <auth@staging.parikshaverse.in>`, production `ParikshaVerse <auth@parikshaverse.in>`.

**Exact external steps required from the developer (phase 14E — do not configure yet):**
1. Create/confirm a Resend account; create an API key for production.
2. Add and verify the sending domain **`parikshaverse.in`** in Resend (publish the DKIM/SPF DNS records Resend provides) — required for `auth@parikshaverse.in`.
3. Decide staging sender strategy: either verify the subdomain **`staging.parikshaverse.in`** in Resend as well, or send staging mail from the verified main domain (e.g. `auth+staging@parikshaverse.in`) — today's `EMAIL_FROM` assumes the subdomain is verified.
4. `wrangler secret put RESEND_API_KEY --env staging` / `--env production` (separate secrets per environment).
5. Post-config verification: deliverability test to a real mailbox (spam placement), link click-through, expiry copy, failure-path check (invalid key → 500 handled by UI).

---

## 8. Authorization / IDOR findings

Full 35-route inventory audited (30 API route files). Session resolution is uniform and fail-closed (`getSession`, session.ts:159-204); all 17 copies of the `resolveOwnedWorkspace` helper re-validate `user_workspaces.userId = session.user.id` before repository calls; client-supplied user IDs are never trusted.

**CONFIRMED GAP (P1) — cross-tenant write via guest migration mock results.**
`src/lib/auth/guest-migration-server.ts:380`: `const targetMockId = mockIdMap.get(gr.mockTestId) || gr.mockTestId;` — `mockIdMap` only contains the payload's own mock tests that resolved into the caller's workspaces; the `||` fallback uses a raw client-supplied ID, and the existence lookup at :349-356 has **no ownership check**. An authenticated user can therefore attach a `mock_test_results` row to **another user's mock test** (insert-only; existing results are dedupe-protected). Exploitability requires knowing the victim's `mockTestId` (derived from a `ws_<uuid>`), and no cross-tenant read primitive was found — hence P1, not P0. Fix: drop the fallback, resolve strictly through the ownership-validated map, and verify the resolved mock's `workspaceId` belongs to the caller before insert. Not covered by tests (tests/unit/guest-migration.test.ts:298-360 tests only self-consistent idempotency).

**Previously fixed mock-result issue — verified fixed:** commit `0aa73ac` re-scoped `mockTestRepository.getResultBySessionId` to `and(eq(sessionId), eq(workspaceId))` and required ownership-resolved mock lookup (mock-test.repository.ts:595-606), with regression tests (tests/unit/security-remediation.test.ts:287-383). Sibling session endpoints all scope `and(id, workspaceId)` — no siblings share the old flaw.

**Near-misses (self-only impact, no cross-tenant write):** migration dedupe lookups by bare client IDs skip-but-don't-overwrite (guest-migration-server.ts:224-228, 287-291, 349-353); migration doesn't pre-validate `examAttemptId` and runs **without a transaction** → partial writes on FK failure (integrity/robustness, P2); `PUT /api/progress` doesn't validate topicId against the workspace taxonomy (self-pollution only); `POST /api/workspaces` non-ensure path doesn't check examAttemptId or cap workspace count (self-only).

**Latent primitive:** `workspace.repository.ts:10-20 getWorkspaceById` fetches by bare ID with no user scoping — currently unused by any route (0 call sites), but an IDOR landmine if ever wired up (P3: delete or scope it).

**Perf/tenancy smell (P3):** `getAllResultsForWorkspace` does a full-table scan of **all users'** `mock_test_results` and JS-filters by workspace test IDs (mock-test.repository.ts:654) — output correctly filtered, but it reads other tenants' rows on every request; push the filter into SQL.

All other routes/areas (workspaces, progress, study-sessions, revision, practice, mock-tests, questions, preferences, analytics, resources) verified SAFE; planner/saved-resource server repositories are stubs (no server write endpoints exist for them).

---

## 9. Session / token findings

- **Algorithm:** HMAC-SHA256 (`crypto.subtle`) over base64url JSON; signing-only (payloads readable, not encrypted — contents are userId/email/iat/exp; acceptable). Web Crypto only → Workers-safe.
- **Magic-link token:** deterministic (no nonce), 15-min expiry, stateless (nothing stored in D1); replayable within TTL (P1 above).
- **Session token:** same HMAC scheme, `{userId, exp:+30d}`; fixed 30-day lifetime; no sliding refresh.
- **Cookie:** `pv_session`, HttpOnly, SameSite=Lax, conditional Secure (forced in staging/prod), Path=/, Max-Age 2592000 (session.ts:134-141).
- **Entropy:** secret-derived (HMAC key); `SESSION_SECRET` must be ≥32 chars and is rejected if equal to the known dev value; recommended production secret: 48-64 random bytes (e.g. `openssl rand -base64 48`) set via `wrangler secret put`.
- **Verification:** constant-time `subtle.verify`; fail-closed `getSession` (signature, expiry, user existence).
- **Revocation:** none (stateless) — P1 decision: add a server-side session/token table (or an explicit "kill switch" such as a per-user `sessionsInvalidAfter` timestamp checked in `getSession`) or formally accept the risk for launch; rotation is the only current lever and is global.
- **Recommended production additions (phase 14B):** random per-token nonce + single-use consumption table; `purpose`-claim validation; (optional) server-side session records.

---

## 10. Headers / edge security findings

**Present:** `poweredByHeader:false` (next.config.ts:5); Set-Cookie flags as above; build-generated `dist/client/_headers` covers only `/_next/static/*` (immutable caching).

**Missing entirely (zero source matches):** `Content-Security-Policy` (incl. `frame-ancestors`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`. **No middleware.ts exists** anywhere; `next.config.ts` has no `headers()`; no source `_headers` file (public/ contains only icon.svg).

**Where they should eventually be implemented (phase 14F, not now):** a source-level `public/_headers` picked up by the Workers assets config (wrangler.jsonc:16-20) for static assets + a middleware.ts (or per-route response wrapper) for HTML/API responses; alternatively Cloudflare Zone-level transform rules. Recommended set: restrictive CSP with nonce support (note GHSA-ffhc-5mcf-pf4q — CSP-nonce XSS fixed in ≥15.5.16, another reason for 14A first), `nosniff`, `DENY`/`frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal allowlist, HSTS with preload decision.

**Cache controls:** zero `Cache-Control`/`no-store` directives in src. Next 15 route handlers are uncached by default and authenticated pages are client components (no PII in prerendered shells), so edge caching of authenticated data is not expected — but responses carrying PII (`/api/auth/session` returns email, session/route.ts:11-18; `/api/progress` returns free-text notes) get no explicit `Cache-Control: no-store` for browser/shared-machine scenarios (P2).

---

## 11. Privacy / data findings

- **Server-side:** email (users.email) + all study data listed in §5. No IP/user-agent columns anywhere. Free-text notes and timezone are the only quasi-sensitive fields.
- **Client-side:** guest data in IndexedDB (localStorage `pv:` fallback) — 11 primary `guest:*` keys + `guest_identity` (random UUID, explicitly no fingerprinting, guest-identity.ts:22-27). **No PII client-side.** Cleanup gap: `clearGuestDomainData` (guest-migration.ts:97-109) misses `guest:mock_tests_sessions` (guest-repositories.ts:610) and `guest:mock_test_results_legacy` (:920,942) → orphaned local data post-migration (P3).
- **Third parties:** Resend (email address + magic-link URL + raw token); Google Fonts Inter self-hosted at build (layout.tsx:2,8-13); no analytics/Sentry/Cloudflare Web Analytics. Nothing else leaves the app.
- **Logs:** only dev-gated console output (email-service.ts:126-128); route handlers swallow errors silently (e.g. verify/route.ts:68-70) — no PII enters Workers logs, but production failures are also invisible (P2: add safe error logging under enabled observability). docs/authentication.md:90 claims sensitive-log filtering "strictly filtered out" — no such code exists (doc debt).
- **Deletion/export:** **none** — no DELETE handlers in src/app/api, no account purge/export, privacy page (src/app/legal/privacy/page.tsx:7-38) has no retention/erasure/GDPR/DPDP language. For an Indian-audience NEET product collecting emails, DPDP Act 2023 alignment is recommended pre/at public launch (P2: data-deletion endpoint + policy update).
- **Magic-link email** carries the raw token in body text as well as the URL (P2: drop the plaintext token from the body once the verify page exists).

---

## 12. Environment-variable matrix

| Variable | Where defined/read | Local | Staging | Production | Secret? | Notes |
|---|---|---|---|---|---|---|
| `ENVIRONMENT` | wrangler vars (all envs); env.ts:80-108; demo gate staging-demo-auth.ts:73-82 | `development` | `staging` | `production` | No | **Required in every deployed env** — several guards key off it (default `development` is fail-safe for demo, fail-open for `_testToken`) |
| `ENABLE_TEST_AUTH_MOCK` | wrangler vars; sign-in/route.ts:46-48; create-account/route.ts:39-41 | `"false"` | `"false"` | `"false"` | No | Strict `=== "true"`; only exposes `_testToken` in dev |
| `NEXT_PUBLIC_APP_URL` | wrangler vars; read server-side only (sign-in:55, create-account:45) | `http://localhost:3000` | `https://staging.parikshaverse.in` | `https://parikshaverse.in` | No | Runtime var, **not** build-inlined; fallback = request host |
| `EMAIL_FROM` | wrangler vars; email-service.ts | `ParikshaVerse Dev <auth@parikshaverse.in>` | `<auth@staging.parikshaverse.in>` | `<auth@parikshaverse.in>` | No | Requires Resend domain verification (§7) |
| `SESSION_SECRET` | crypto-session.ts:41-43 | `.env.local` (64-char, gitignored) | `wrangler secret put --env staging` | `wrangler secret put --env production` | **SECRET** | ≥32 chars; dev default rejected; never in wrangler vars (enforced by tests/unit/staging-deployment.test.ts:105-112) |
| `RESEND_API_KEY` | email-service.ts:159-161 | empty → console provider | secret (`--env staging`) | secret (`--env production`) | **SECRET** | Never committed |
| `NODE_ENV` | set by next dev / vinext build; fallback in env detection | `development` | (managed by build) | (managed by build) | No | Fallback only — `ENVIRONMENT` is authoritative |
| `DB_NAME` | `.env.example` (local shim) | local sqlite name (stale: `pariksha-verse-db`) | — | — | No | Local-only; update example when fixing db:seed |
| `VERCEL_ENV` / `CF_PAGES` | defensive reads only (crypto-session.ts:57; staging-demo-auth.ts:101) | never set | never set | never set | No | Platform-detection belt-and-braces |
| Binding `DB` | wrangler d1_databases | `pariksha-verse-db-local` | `pariksha-verse-db-staging` | `pariksha-verse-db-production` | n/a | Binding, not a var |
| Binding `ASSETS` | wrangler.jsonc:16-20 | — | — | — | n/a | Static assets |

**Must never be client-exposed:** `SESSION_SECRET`, `RESEND_API_KEY` (both server-read only; `getCloudflareEnv()` throws in client bundles, env.ts:68-77). Safe public values: everything in wrangler `vars`. **No secret values were read or printed during this audit.**

---

## 13. Production deployment procedure (design — do not execute)

1. **Dependency/security gate (14A first):** `pnpm audit --prod` clean; `typecheck`, `lint`, 474 unit tests, local Playwright green.
2. **Create production D1:** `wrangler d1 create pariksha-verse-db-production` → paste returned UUID into `wrangler.jsonc:62`.
3. **Configure secrets:** `wrangler secret put SESSION_SECRET --env production` (≥32 random chars); `wrangler secret put RESEND_API_KEY --env production`.
4. **Apply migrations:** `pnpm db:migrate:prod` (wrangler d1 migrations apply … --env production --remote; runs 0000-0004).
5. **Seed canonical data (hard gate before any traffic):** `wrangler d1 execute pariksha-verse-db-production --env production --remote --file src/db/seeds/seed-neet.sql`; verify counts (1 exam / 1 attempt / 3 subjects / 52 chapters / 139 topics / 150 questions / 600 options / 0 users). (Fix `db:seed` script separately — §5.)
6. **Domain:** configure `parikshaverse.in` route/custom domain on the production worker (wrangler `routes`/`custom_domains` or dashboard) and decide workers.dev visibility.
7. **Build:** `pnpm cf:build`.
8. **Dry-run:** `wrangler deploy --env production --dry-run` (config/bindings validation).
9. **Deploy:** `pnpm cf:deploy:prod`.
10. **Verify health:** `GET /api/health` → `environment:"production"`, `d1Configured:true` (plus a real D1 probe check from §10/14G).
11. **Verify auth:** full AUTH section of the smoke plan (§14) with a real mailbox.
12. **Verify core product flows:** GUEST + DATA sections of the smoke plan.
13. **Monitor:** `wrangler tail --env production`, Workers observability dashboard, D1 metrics; document the D1 Time Travel restore drill.

---

## 14. Production smoke-test plan (design — do not execute)

Run the existing `tests/e2e/staging` suite against `PLAYWRIGHT_BASE_URL=https://parikshaverse.in` (skip the demo-auth specs — demo auth must 404 in production) plus these explicit probes:

**PUBLIC (unauthenticated):** landing renders; exam selection; resource/legal pages; PWA manifest loads; `/_next/static/*` assets 200; no `X-Powered-By`.
**GUEST:** guest entry → NEET 2027 onboarding; syllabus browse; study session; practice session; revision; mock hub; analytics render from IndexedDB state; refresh persistence.
**AUTH (real mailbox):** create-account → email received from `auth@parikshaverse.in` (spam-folder check) → **email button lands on `/auth/verify` and completes** (validates the 14B page) → session persists across refresh → logout → sign back in; token expired after 15 min.
**DATA (authenticated):** workspace creation; topic progress upsert; study session logged; practice attempt logged; mock result recorded; revision item rescheduled; analytics reflect the above; guest→account migration moves local data.
**SECURITY (curl/playwright API probes):**
- Unauthenticated `GET /api/workspaces` → 401.
- Cross-workspace: valid session B requests workspace A's id (`/api/mock-tests?workspaceId=<A>`) → empty/403/404, never A's data.
- Expired auth token (craft/wait) → verify rejected; session rejected after expiry.
- Invalid verification token → generic failure, no info leak.
- **Replayed verification token** → after 14B: rejected (second use fails); records the current behavior until then (replay succeeds within 15 min).
- `POST /api/auth/demo` on production → **404**.
- `POST /api/auth/sign-in` response body contains **no** `_testToken`.
- Magic-link email URL host is `parikshaverse.in` (not the request-host fallback).
- Security headers present on `/` and `/auth/sign-in` (after 14F).
**MONITOR:** `wrangler tail` streaming during the run; zero unhandled exceptions; D1 query metrics sane.

---

## 15. Go / No-Go matrix

| Area | Current State | Risk | Required Before Production | Priority |
|---|---|---|---|---|
| Dependencies | 52 advisories (5 crit/22 high) | RCE (CVSS 10.0) in production runtime path | Upgrade set in §3.3; `pnpm audit --prod` clean | **P0** |
| Next.js security | next@15.2.0, 3 criticals apply | Audit gate + defense-in-depth (Windows/AVIF RCEs N/A on Workers) | → 15.5.26 (+ eslint-config-next) | **P0** |
| React/RSC security | RSDW@19.0.0 pinned; react 19.3.0 OK | Live RCE deserializer in Worker | → ^19.2.8 + vinext 1.0.0 | **P0** |
| Cloudflare | Staging deployed/validated; prod worker config ready | Deploy fails on placeholder D1 id | Create prod D1 + UUID; decide domain | **P0** |
| D1 | Production DB does not exist | — | Create; then migrate | **P0** |
| Migrations | 5 pure-DDL, D1-compatible, from-scratch safe | drizzle meta drift (db:generate trap) | Run db:migrate:prod | **P0** (P2: meta fix) |
| Seed data | Idempotent, authored-only, 0 user rows; seed script broken for remote | Fixture injection if unseeded (q_fix_*) | Seed before traffic; fix db:seed script | **P0 gate / P1 script** |
| Auth | Core solid (fail-closed, secret hardening, scoped queries) | **Verify page missing → magic link 404s** | Build /auth/verify page + e2e | **P0** |
| Email | Fail-closed without key; Resend wired | No domain verification → no mail; no retry/timeout | Resend domain verify + secrets + deliverability test | **P0** |
| Sessions | HMAC, HttpOnly/Lax/conditional-Secure, 30d | No revocation; stolen cookie lives 30d | Server-side revocation or documented risk acceptance | **P1** |
| Rate limiting | None anywhere | Email bombing, enumeration, brute force | CF WAF rate rule on /api/auth/* + app-level limiter | **P1** |
| Token replay | Replayable within 15 min | Session minting on replay | Single-use nonce + consumption table | **P1** |
| Revocation | Stateless only | No kill switch | (same as Sessions) | **P1** |
| Authorization/IDOR | 34/35 routes safe; prior mock-result IDOR fixed & regression-tested | Cross-tenant insert via migration fallback | Fix guest-migration mock-result target resolution | **P1** |
| Headers | Only poweredByHeader:false | Clickjacking, sniffing, no HSTS/CSP | Add header set (14F) | **P1** |
| Cookies | Solid flags, forced Secure in prod | — | None (verify in smoke) | — |
| Privacy | Minimal PII, no third-party analytics | No deletion/export; DPDP gap | Deletion endpoint + policy text | **P2** |
| Monitoring | Observability enabled; silent catch blocks; health doesn't probe D1 | Outages invisible | Error logging + DB health probe + alerting | **P2** |
| Backups/recovery | None documented (D1 Time Travel PITR exists natively, 30-day window) | Data-loss runbook missing | Document + rehearse restore | **P2** |
| PWA | Manifest SVG-only icons; no service worker | Offline claim unbacked; icon quality | PNG icons; SW decision | **P3** |
| E2E | 142 local + staging suites green (per Phase 13) | Email-auth specs never ran against a real deployment | Prod smoke run (§14) | **P0 gate** |
| Mobile | Emulation green; physical device pending | Real-touch behaviors unverified | Pixel 10 physical pass | **P2** |
| Deployment | Scripts exist; env separation verified | `vinext:deploy`/`cf:preview` footguns | Use `cf:deploy:prod` only; fix footgun scripts | **P1 procedure / P2 scripts** |

No overall readiness score is given, per scope. **Concrete blockers with evidence are listed in §17.**

---

## 16. Implementation phases (proposed minimal safe sequence)

**14A — Dependency/security upgrade (P0, blocks everything)**
Objective: clear the advisory set without architecture change. Files: package.json, pnpm-lock.yaml (versions per §3.3). External: none. Code changes: none expected. Tests: audit clean, typecheck, lint, 474 unit, full local e2e; redeploy staging and re-run staging suites (desktop+mobile). Deploy impact: staging redeploy required (first post-`0aa73ac`+upgrade build). Rollback: git revert + lockfile restore. **Blocks production.**

**14B — Auth completion & hardening (P0 for verify page; P1 for the rest)**
Objective: make magic-link flow work and close deferred hardening. Files: new `src/app/auth/verify/page.tsx` (+ client verify wiring), `crypto-session.ts` (random nonce, purpose validation), new single-use token table migration + consumption check, `guest-migration-server.ts:380` ownership fix, rate limiting module + route wrappers, enumeration normalization, `_testToken` fail-closed default. External: none. Tests: new unit tests (replay rejected, migration cross-tenant blocked, rate limit 429s), e2e AUTH suite. Rollback: revert commits; token table is additive. **Verify page blocks production; rate limiting/replay/revocation block public launch.**

**14C — Production Cloudflare infrastructure (P0)**
Objective: real prod resources. External: `wrangler d1 create pariksha-verse-db-production`; UUID into wrangler.jsonc:62; `wrangler secret put` ×2 (`--env production`); domain route config. Files: wrangler.jsonc. Tests: `--dry-run` deploy; staging `GET /api/health` reports `staging` (redeploy staging from HEAD if stale). Rollback: no code path; delete resources. **Blocks production.**

**14D — Production data (P0 gate)**
Objective: migrated+seeded prod DB. Steps: `db:migrate:prod`; seed via `wrangler d1 execute --env production --remote --file src/db/seeds/seed-neet.sql`; count verification; fix `src/db/seeds/run.ts:15` (DB name + `--remote` support) so the script path also works. Tests: count assertions; fixture-absence check (`SELECT count(*) FROM questions WHERE provenance='fixture'` = 0). **Seeding-before-traffic blocks production.**

**14E — Production email (P0)**
Objective: deliverable auth email. External: Resend account, domain verify (DKIM/SPF for parikshaverse.in, staging subdomain decision), API key → secret. Files: none (config only; optional retry/timeout hardening to email-service.ts). Tests: AUTH smoke with real mailbox; failure-path check. **Blocks production (no email = no signups).**

**14F — Headers & edge hardening (P1)**
Objective: security headers + cache posture. Files: `public/_headers`, new middleware.ts (or response wrapper), optional `Cache-Control: no-store` on auth/PII APIs, `.gitignore` += `.dev.vars`, fix `vinext:deploy`/`cf:preview` scripts. Tests: header assertions in e2e; CSP smoke (no console violations). Rollback: remove headers file/middleware. **Blocks public launch, not internal deploy.**

**14G — Observability & ops (P2)**
Objective: operable service. Files: error logging in route catch blocks (no PII), health route D1 probe, global error.tsx/not-found.tsx, backup/restore runbook (D1 Time Travel drill), optional account-deletion endpoint + privacy policy update (DPDP). **Does not block deploy; blocks confident operations.**

**14H — Production smoke tests & deployment (P0 gate)**
Objective: execute §13 procedure + §14 smoke plan; go/no-go per §15; monitor for 48h post-launch. **Final gate.**

Dependency notes: 14A → 14B (CSP-nonce fix needed before header work; upgraded next before new middleware). 14C ∥ 14E (independent externals). 14D after 14C. 14F after 14A. 14H last. Next 16 migration is a deliberate post-launch phase (Next 15 EOL 2026-10-21) and is **not** part of the launch path.

---

## 17. Exact blockers before first production deployment

1. **CVE-2025-55182 RCE** — `react-server-dom-webpack@19.0.0` pinned in `package.json:52` (and via vinext > @vitejs/plugin-rsc); the deployed Worker deserializes RSC payloads with this package. Upgrade to ≥19.2.6 (recommend 19.2.8) together with vinext/@vinext/cloudflare 1.0.0. *(GHSA-fv66-9v8q-g76r)*
2. **next@15.2.0** — 3 critical + 14 high/moderate current advisories on the exact version. Upgrade to 15.5.26 (+ eslint-config-next 15.5.26). *(GHSA-9qr9-h5gf-34mp, GHSA-f82v-jwr5-mffw, GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4, et al.)*
3. **Missing `/auth/verify` page** — email sign-in button 404s; `src/app/auth/` has only create-account/sign-in; no rewrites/middleware (next.config.ts:1-9). Production auth unusable on the primary path.
4. **Production D1 does not exist** — placeholder `REPLACE_WITH_PRODUCTION_D1_DATABASE_ID` (wrangler.jsonc:62); deploy and migrations fail until created and wired.
5. **Production secrets not provisioned** — `SESSION_SECRET` (auth throws without it, crypto-session.ts:60-77) and `RESEND_API_KEY` (sign-in hard-500s, email-service.ts:184-194); per-env `wrangler secret put` required.
6. **Resend sending domain not verified** — `auth@parikshaverse.in` (and the staging sender) undeliverable until DKIM/SPF verification; no magic link can arrive.
7. **Production not seeded before traffic** — with an empty `questions` table, the first practice/mock request injects 120 fixture questions into prod (`ensureFixtureQuestionsSeeded`, question.repository.ts:42-49, called from :153/:245 and mock-test.repository.ts:234). Seeding is a hard pre-traffic gate (code guard recommended, P2).

**Pre-public-launch (P1) requirements:** rate limiting (none exists); single-use verification tokens; session revocation decision; guest-migration mock-result ownership fix (guest-migration-server.ts:380); security headers (CSP/XCTO/XFO/Referrer-Policy/Permissions-Policy/HSTS); production custom-domain wiring; staging redeployed from HEAD with `environment:"staging"` health confirmation; `drizzle-orm ≥0.45.2` (GHSA-gpj5-g38j-94v9).

**Audit artifacts:** this report (untracked); no other repository modifications; `pnpm audit` JSON inspected at `%TEMP%\pv-audit.json` (outside the repo); no Cloudflare state read or changed beyond public registry/doc lookups.

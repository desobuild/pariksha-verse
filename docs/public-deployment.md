# ParikshaVerse — Public Deployment (Phase 14I)

Normative record of the **public** ParikshaVerse deployment: what is served,
where it runs, how it is authenticated, how it is validated, and how it is
operated. Established and validated in Phase 14I on 2026-10-01.

## Public URL

**https://pariksha-verse-staging.desobuild.workers.dev/**

This is the single canonical public origin of ParikshaVerse. It is the
canonical origin for the PWA manifest (`start_url: "/"`), for session cookies,
and for all client entry points. No custom domain exists or is planned:
`parikshaverse.in` is intentionally **not** registered and is not required for
the public deployment.

## Environment

| Item | Value |
| --- | --- |
| Environment | `staging` (`ENVIRONMENT=staging` Worker var) |
| Worker | `pariksha-verse-staging` (workers.dev subdomain enabled) |
| Database | `pariksha-verse-db-staging` (D1 id `bbe9b6c9-1c52-4b67-b513-c51b2b99a505`, binding `DB`) |
| App URL var | `NEXT_PUBLIC_APP_URL=https://pariksha-verse-staging.desobuild.workers.dev` |
| Test-auth mock | `ENABLE_TEST_AUTH_MOCK=false` (double-gated off) |
| Secrets | `SESSION_SECRET` only (secret-backed, staging-scoped value) |
| Public signup | **Disabled** — email account creation cannot complete (no Resend provider configured; the flow fails closed) |
| Resend | Not configured, intentionally absent |
| Email | Never sent from staging; no `RESEND_API_KEY` exists in the environment |

The staging configuration lives in `wrangler.jsonc` under `env.staging` and is
pinned by `tests/unit/staging-deployment.test.ts` (worker name, D1 database
name/id, var values, and secret hygiene are all asserted).

## Authentication

The public deployment uses the **sanctioned staging demo authentication**
(`POST /api/auth/demo`, Phase 13A.3):

- The `/auth/sign-in` page renders a "Pick a demo profile" panel with the fixed
  roster **Friend 1 – Friend 5**.
- Identity is derived exclusively from a fixed server-side roster
  (`src/lib/auth/staging-demo-auth.ts`); the client can only choose a slot.
  Demo user IDs/emails are deterministic and stable across deploys
  (`usr_demo_staging_friend1` … `friend5`, non-deliverable `*.invalid` emails).
- Signing in issues the **same** `pv_session` cookie as the production
  magic-link flow: HMAC-signed with the staging `SESSION_SECRET`, 30-day
  expiry, `HttpOnly` + `SameSite=Lax` + `Secure` (HTTPS), backed by a
  server-side revocable session record.
- Sign-out (`POST /api/auth/sign-out`) revokes the server-side session; a
  stolen/replayed cookie is dead afterwards.
- The endpoint is IP rate-limited (`auth_demo_ip`: 60 sign-ins / 10 min).
- **Staging-only**: the gate `isStagingDemoAuthEnabled()` fails closed in
  every other environment — production returns 404 "Not found" for
  `/api/auth/demo`, and no demo user/workspace can be provisioned there.
- `GET /api/auth/demo` returns 405 (the endpoint is POST-only by design).

Public email signup (create-account / magic-link) is **not** offered: no
Resend key is configured, so verification emails cannot be delivered and the
flow fails closed. No real users are created on staging.

## Guest mode

Guests can use the full preparation product without an account:

- "Continue as guest" establishes a local guest identity
  (`crypto.randomUUID()`, stored under `pv:guest_identity`).
- All guest data (workspaces, topic progress, study sessions, practice
  history, revision schedule, mock results, analytics) persists **only on the
  device** in browser IndexedDB (`pariksha_verse_db`, prefixed `pv:`). See
  `docs/guest-mode.md`.
- Guest progress survives reloads and browser restarts, and never leaves the
  device until an explicit sign-in.

### Guest → account migration

On demo sign-in after guest usage, the client posts the guest workspace(s) to
`POST /api/auth/migrate` (authenticated, ownership-checked), which attaches the
guest's data to the demo user's workspace:

- Guest progress (topic statuses, practice, revision, mock history) is
  preserved through migration and visible after refresh and after a fresh
  sign-in.
- Migration is scoped to the signed-in user's own workspaces — no data from
  another workspace/user can be attached.
- Migration is idempotent: repeating it does not duplicate records.
- Validated by `tests/e2e/staging/guest-migration.spec.ts` and the migration
  unit suites (`guest-migration*.test.ts`).

## Supported validation (public user journey)

The validated public journey (guest and authenticated):

```
Landing → Exam selection (NEET) → Dashboard
  → Study (subject → chapter → topic)
  → Practice (topic/subject/mixed sessions, 5/10/20 questions,
    mark-for-review, timer, result review, history, weak topics)
  → Revision (due/overdue queue, completion rescheduling:
    1 → 3 → 7 → 14 → 30 days)
  → Mock tests (instructions, timer, palette, submission, scoring,
    question-by-question review, history)
  → Analytics/Progress (coverage, study time, performance, trends;
    7/30/90 days/all-time filters)
```

Authenticated runs repeat the same journey with server-side persistence
(D1-backed workspaces), plus sign-out and re-login. Regression coverage:
`tests/e2e/` (product specs) and `tests/e2e/staging/` (deployment specs:
smoke, demo-auth, user-isolation, guest-mode, guest-migration,
practice-extended, analytics-extended, mobile-layout, security-headers,
critical-flows), run against the public URL with
`PLAYWRIGHT_BASE_URL` + `PLAYWRIGHT_TARGET=staging`, serially (`--workers=1`).

Content baseline served to every user (D1, read-only canonical data):
1 exam, 1 exam attempt (NEET), 3 subjects, 52 chapters, 139 topics,
150 authored questions (`ParikshaVerse Authored Bank`), 600 options
(50 questions per subject; exactly one correct option per question; all
questions carry explanations and supported difficulty values).

## Production

The production Worker is **separate and dark** — it is NOT the public
deployment and must not be touched by public-deployment operations:

| Item | Value |
| --- | --- |
| Worker | `pariksha-verse-production` |
| D1 | `pariksha-verse-db-production` (`34609461-2d5e-4bad-9088-71a9416c36f1`) |
| Visibility | workers.dev route deliberately **disabled** (returns error 1042); no custom domain attached |
| Users | 0; demo auth fails closed (404); email signup cannot complete |

Consequences of this contract:

- Production D1 remains untouched by staging usage; the two D1 databases are
  distinct (name and id asserted by unit test).
- No custom domain is used anywhere; `parikshaverse.in` is intentionally not
  required for the public deployment.
- Staging secrets (session secret) are separate from production secrets.
- Fixture seeding and test-auth mock can never run outside local development
  (`ENABLE_TEST_AUTH_MOCK=false` in both deployed envs; seed scripts are
  explicit, per-environment commands that are not part of any deploy).

## Operations

### Health & readiness

- `GET /api/health` → `200 {ok, status:"healthy", service:"pariksha-verse",
  environment:"staging", version, deployment}` where `deployment` is the
  build-time git SHA baked by `scripts/generate-build-info.mjs`. No secrets or
  internals are exposed.
- `GET /api/health/ready` → `200 {ok, service, environment:"staging"}` after
  verifying D1 (`SELECT 1`) and the session secret; failure details are never
  exposed.
- Workers.dev may serve a short-lived edge-cached copy of `/api/health` right
  after a deploy (observed in Phase 14H/14I); a query-string cache-buster
  (e.g. `/api/health?v=<anything>`) always returns the fresh body. No
  cache-bypass architecture is warranted for a liveness endpoint.

### Logs

- Workers observability is enabled (`wrangler.jsonc`); every structured log
  line carries `timestamp, level, service, environment, event, version,
  deployment, request_id` plus event-specific non-sensitive fields.
- Inspect with `npx wrangler tail pariksha-verse-staging --format json` or the
  Cloudflare dashboard (Workers → pariksha-verse-staging → Logs).
- Logging hygiene (validated in Phase 14I): no exceptions, no secrets, no
  session cookies, no tokens, no emails, no answer payloads in application
  logs. Demo logins log only the fixed roster `slot`.

### Deployment procedure

```
pnpm cf:deploy:staging
# = node scripts/generate-build-info.mjs && vinext-cloudflare deploy --env staging
```

The build-info generator runs automatically as the first step of the deploy
script (fixed in Phase 14I — previously the deployment SHA could go stale
unless the generator was run manually). The deploy rebuilds with
`CLOUDFLARE_ENV=staging` (baking the staging name/vars/D1 binding into
`dist/server/wrangler.json`) and uploads via wrangler. Verify afterwards:

```
npx wrangler deployments list --env staging
curl.exe -s "https://pariksha-verse-staging.desobuild.workers.dev/api/health?v=deploy"
```

`environment` must be `staging` and `deployment` must equal `git rev-parse
HEAD` of the clean tree that was deployed. Deploy scripts never run
migrations or seeds.

### Rollback procedure

Worker-only rollback (safe; D1 is not involved):

```
npx wrangler rollback <version-id> --env staging
```

Substitute a version ID from `npx wrangler deployments list --env staging`.
Phase 14I deployment: version `1e5f3d99-7a1a-4e2a-9564-87822bcf5cc6` (git SHA
`b11f2d3e2561f4a372e47f000e1373262a6da21b`); the previous staging version
`a98c01bc-6c0d-40d4-96bd-47669d1e0921` is the first rollback target. Verify
with `/api/health` returning the previous build's SHA. A D1 rollback is never
automatic and requires explicit compatibility analysis first (see
`docs/phase-14h-deployment.md` §5).

### Security posture (validated on the public URL)

Every document and API response carries: CSP (`default-src 'self'` +
per-request `nonce-…` + `strict-dynamic`), HSTS
(`max-age=300; includeSubDomains`), `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` (all deny-listed), `COOP: same-origin`, and an
`X-Request-ID`. No CORS headers are advertised. Protected APIs return uniform
`401 {"error":"Unauthorized"}` when unauthenticated; invalid/replayed
verification tokens return generic errors; session revocation kills cookies
server-side; tenant isolation is enforced by workspace ownership checks
(unit + E2E suites). Security-header regression coverage lives in
`tests/e2e/staging/security-headers.spec.ts` and
`tests/unit/security-headers.test.ts`.

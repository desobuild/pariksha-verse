# Phase 14H — Production Deployment Record & Rollback Procedure

Normative deployment record for the Phase 14H controlled production deployment.
Pre-deployment sections are written before the deploy; the post-deployment
record is appended after the deployment completes.

## 1. Deployment identity

| Item | Value |
| --- | --- |
| Repository state at build | `main` @ HEAD of the final pre-deployment commit (clean tree; all Phase 14A–14G work plus this record committed deliberately for deployment auditability — exact SHA recorded in Section 7, baked by `scripts/generate-build-info.mjs` at build time) |
| Application version | `0.1.0` (package.json; also baked as `version` in `/api/health`) |
| Deployment identifier | the build-time git SHA, baked as `deployment` in `/api/health` and every structured log line (exact value in Section 7) |
| Worker (production) | `pariksha-verse-production` |
| Worker (staging) | `pariksha-verse-staging` |
| Production D1 | `pariksha-verse-db-production` (`34609461-2d5e-4bad-9088-71a9416c36f1`) |

## 2. Pre-deployment state (recorded before deploy)

### 2.1 Previous production Worker versions

Workers → `pariksha-verse-production` → Deployments, all created 2026-09-30:

1. `0509c1fc-d858-46c4-a8af-670e27d996db` — initial upload, 06:29:58 UTC
2. `37af329b-7ccf-4a85-8e3a-a42979ac88b5` — Secret Change, 06:29:59 UTC
3. `6fd21834-4962-47b1-bc36-3f64b3bc197e` — Secret Change, 06:30:35 UTC — **active (100%) immediately before the Phase 14H deploy**

The production Worker has been dark since upload: its workers.dev route is
disabled (Cloudflare API: `enabled: false`) and no custom domain was attached
(`parikshaverse.in` is not registered / not in DNS — verified via RDAP and
DNS on 2026-10-01). Zero production users exist, so the deploy touches no
live traffic.

### 2.2 Production database state (verified read-only, 2026-10-01)

Migrations 0000–0005 applied (`wrangler d1 migrations list`: "No migrations to
apply"). Counts: `users` 0, `user_workspaces` 0, `exams` 1,
`exam_attempts` 1 (canonical), `subjects` 3, `chapters` 52, `topics` 139,
`questions` 150, `question_options` 600, `verification_tokens` 0,
`user_sessions` 0, `rate_limit_buckets` 0, `practice_sessions` 0,
`study_sessions` 0, `revision_items` 0, `mock_test_sessions` 0.

### 2.3 Secrets

`SESSION_SECRET` is the only production secret (secret-backed, verified via
`wrangler secret list --env production`). No Resend key, no test credentials.
Staging holds its own separate `SESSION_SECRET`.

## 3. Deployment procedure

Established repository mechanism (package.json):

```
pnpm cf:deploy:prod
# = vinext-cloudflare deploy --env production
#   1. rebuilds with CLOUDFLARE_ENV=production so dist/server/wrangler.json
#      bakes the production env (name, vars, D1 binding) — verified in Part F
#   2. spawns `wrangler deploy --env production`, which follows the redirect
#      config .wrangler/deploy/config.json to the emitted
#      dist/server/wrangler.json (dry-run verified: env.DB =
#      pariksha-verse-db-production, env.ENVIRONMENT = "production")
```

Staging equivalent: `pnpm cf:deploy:staging`.

Explicitly out of scope for the deployment (must never run as part of it):
`db:migrate:prod`, `db:seed:prod` — the database is already correct; the
deployment performs zero D1 mutations.

## 4. Identifying the deployment

- Cloudflare dashboard: Workers & Pages → `pariksha-verse-production` →
  Deployments → newest entry (Author, Source = Upload, timestamp, Version ID).
- CLI: `npx wrangler deployments list --env production`.
- Application-side: `GET /api/health` returns `deployment = <build-time git
  SHA>` and `version = 0.1.0`; every Workers Log line carries the same fields.

## 5. Rollback procedure

Worker code rollback (safe, no database involvement):

```
npx wrangler rollback 6fd21834-4962-47b1-bc36-3f64b3bc197e --env production
```

`wrangler rollback` re-points 100% of traffic at the given version instantly
(no rebuild); verify afterwards with `npx wrangler deployments list --env
production` and `GET /api/health` (`deployment` returns to the previous
build's SHA). To roll back to any other listed version, substitute its
version ID from Section 2.1 / the deployments list.

Database rollback — NOT automatic, NOT part of worker rollback:

- The deployment runs no migrations and no seed; D1 is untouched by the
  deploy itself.
- Migration 0005 (`0005_auth_security_tables.sql`) is additive (verification
  tokens, user sessions, rate-limit buckets) and was already applied and
  validated before this deploy; rolling it back is neither required nor
  planned.
- Any future D1 schema/data rollback requires explicit compatibility analysis
  first (which tables the deployed code reads/writes); never "blind-rollback"
  D1 alongside a worker rollback.

## 6. Known deployment-environment item (outside the repository)

`NEXT_PUBLIC_APP_URL=https://parikshaverse.in` is the intended production
origin, but the domain is not yet registered/connected (NXDOMAIN + RDAP 404
on 2026-10-01), and the production worker's workers.dev route is disabled
(deliberate hardening). The Worker deploy itself is unaffected; custom-domain
registration/connection is an account-owner action and is the only remaining
step for `https://parikshaverse.in` to serve traffic. Post-deployment
validation is performed through the available channel and recorded in
Section 7.

## 7. Post-deployment record

Recorded 2026-10-01, immediately after deployment:

### 7.1 Deployment

| Item | Value |
| --- | --- |
| Status | **Deployed, healthy, validated** |
| Deployed at | `2026-10-01T07:05:55.900Z` (deployment applied 07:05:57.554Z) |
| Git SHA | `dfc092b51a44db5f7445627315420e1a2e993cc2` (clean tree; includes the Phase 14A–14G working-tree commit `f32b78929d11f2d2178a6628542f590172256f48` and the two Phase 14H documentation commits) |
| Application version | `0.1.0` |
| Cloudflare version ID | `b75e3f63-8c59-4fcd-a76a-d386c4c78fdc` (100% traffic) |
| Previous version ID | `6fd21834-4962-47b1-bc36-3f64b3bc197e` (rollback target; procedure in Section 5) |
| Staging redeploy (Part H) | `a98c01bc-6c0d-40d4-96bd-47669d1e0921` @ `pariksha-verse-staging`, same commit SHA |

### 7.2 Production validation results

- `GET /api/health` → 200 `{ok:true, status:"healthy", service:"pariksha-verse",
  environment:"production", version:"0.1.0", deployment:"dfc092b51a44db5f…"}`;
  no secrets or internals.
- `GET /api/health/ready` → 200 `{ok:true, service:"pariksha-verse",
  environment:"production"}` (D1 `SELECT 1` + SESSION_SECRET both verified;
  failure detail is never exposed by design).
- Headers on documents and APIs: CSP (nonce + strict-dynamic), HSTS
  (max-age=300; includeSubDomains), X-Content-Type-Options: nosniff,
  X-Frame-Options: DENY, Referrer-Policy: strict-origin-when-cross-origin,
  Permissions-Policy (all deny-listed), COOP: same-origin, X-Request-ID. No
  CORS headers advertised anywhere.
- Public pages 200: `/`, `/exam/select`, `/legal/privacy`, `/legal/terms`,
  `/manifest.webmanifest`, `/icon.svg`; static chunks served immutable
  (`public, max-age=31536000, immutable`) with `nosniff` from `public/_headers`.
- Auth boundaries: `/api/auth/demo` fails closed in production (404 "Not
  found"); `/api/auth/verify` rejects an invalid token with a generic 401;
  protected `/app/*` routes follow the designed workspace-less shell flow;
  protected APIs return 401 `{"error":"Unauthorized"}` (verified on staging
  with the same build); public email signup cannot complete (no Resend
  provider configured — fails closed); test-auth mock is double-gated off.
- `wrangler tail`: requests execute with outcome success, status 200, no
  exceptions, no unexpected log lines.

### 7.3 Production D1 post-deployment counts (read-only)

`users` 0, `user_workspaces` 0, `exams` 1, `exam_attempts` 1 (canonical),
`subjects` 3, `chapters` 52, `topics` 139, `questions` 150,
`question_options` 600, `verification_tokens` 0, `user_sessions` 0,
`practice_sessions` 0, `study_sessions` 0, `revision_items` 0,
`mock_test_sessions` 0, `question_attempts` 0, `mock_test_results` 0,
`rate_limit_buckets` 2 — both rows are the single documented validation probe
(`/api/auth/verify` with an invalid token, 2026-10-01 ~07:10 UTC: one
`auth_verify_email:probe@example.com` bucket and one `auth_verify_ip` bucket
for the validation host). They contain no user data and age out via the
built-in 2-hour window sweep. No unexpected users, activity, or writes; the
canonical exam/content data is byte-identical (same database size, 28 tables).

### 7.4 Deployment-environment changes made and reverted (deliberate, documented)

- `wrangler deploy` auto-enabled the production Worker's workers.dev route
  (`enabled:true, previews_enabled:true`); it had been deliberately disabled
  pre-deploy (the Worker was dark — unregistered domain). To run the mandatory
  post-deployment validation the route was used while enabled, and was
  **restored to `enabled:false, previews_enabled:false`** immediately after
  validation (Cloudflare API `POST …/scripts/pariksha-verse-production/subdomain`).
  Production is dark on workers.dev again; only the custom domain (when
  registered and connected) will serve it.

### 7.5 Known non-blocking items carried forward

- Repo-wide historical Prettier non-compliance (`pnpm format:check`) —
  pre-existing, unchanged this phase.
- `middleware.ts` → `proxy` file-convention deprecation notice from
  vinext/Next 15.5 — pre-existing, planned migration later.
- `next lint` deprecation (Next 16 will remove it; ESLint 9 flat-config
  migration) — pre-existing.
- `parikshaverse.in` is not registered/connected (NXDOMAIN + RDAP 404 on
  2026-10-01): the Worker is deployed and validated but the intended custom
  origin serves nothing until the domain is registered and attached. This is
  the only remaining step to make `https://parikshaverse.in` live.
- `pnpm cf:deploy:*` scripts do not regenerate build-info before deploying
  (deployment identifiers can lag unless `node scripts/generate-build-info.mjs`
  runs first — it was run explicitly for both Part H and Part I deploys).
- `/api/health` responses are edge-cacheable on workers.dev for a short
  window after a deploy (observed on staging during Part H); a cache-busting
  query parameter returned the fresh body. Harmless for a liveness endpoint,
  noted for future monitoring integration.

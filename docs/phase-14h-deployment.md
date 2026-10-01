# Phase 14H — Production Deployment Record & Rollback Procedure

Normative deployment record for the Phase 14H controlled production deployment.
Pre-deployment sections are written before the deploy; the post-deployment
record is appended after the deployment completes.

## 1. Deployment identity

| Item | Value |
| --- | --- |
| Repository state at build | `main` @ `f32b78929d11f2d2178a6628542f590172256f48` (clean tree; all Phase 14A–14G work committed deliberately for deployment auditability) |
| Application version | `0.1.0` (package.json; also baked as `version` in `/api/health` via `scripts/generate-build-info.mjs`) |
| Deployment identifier | `f32b78929d11f2d2178a6628542f590172256f48` (baked as `deployment` in `/api/health` and every structured log line) |
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
- Application-side: `GET /api/health` returns
  `deployment = f32b78929d11f2d2178a6628542f590172256f48` and
  `version = 0.1.0`; every Workers Log line carries the same fields.

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

_Appended after the deployment completes._

# Observability & Operations (Phase 14G)

Operational runbook for diagnosing ParikshaVerse once deployed. Everything here
is server-side and privacy-conscious: **no secrets, tokens, session material,
email addresses, question/answer content, or user data ever reaches a log line
or a public endpoint.**

---

## 1. Health endpoint — `GET /api/health`

Liveness probe. Answers one question: _is the Worker runtime up and serving?_
It performs **no database query** and reads no bindings, so it is cheap and
deterministic — Cloudflare health monitors and smoke tests can hit it freely.

```json
{
  "ok": true,
  "status": "healthy",
  "service": "pariksha-verse",
  "environment": "staging",
  "version": "0.1.0",
  "deployment": "<git commit sha>"
}
```

| Field           | Meaning                                                                            |
| --------------- | ---------------------------------------------------------------------------------- |
| `ok` / `status` | Runtime functioning (`"healthy"` kept for the Phase 14F contract)                  |
| `environment`   | Resolved from Cloudflare `ENVIRONMENT` var (Node fallback locally)                 |
| `version`       | package.json version at build time                                                 |
| `deployment`    | Full git commit SHA the build was produced from (`unknown` if git was unavailable) |

Exposes **no** secrets, binding objects, database configuration, or internals.

## 2. Readiness endpoint — `GET /api/health/ready`

Readiness probe for the two dependencies the app actually requires:

1. **Database** — one deterministic `SELECT 1` through the normal `getDb()`
   path (real D1 binding on the Worker; local dev adapter in Node runtimes).
2. **Auth configuration** — `SESSION_SECRET` resolves for this environment
   (fails closed in staging/production when missing, the known dev value, or
   shorter than 32 chars).

- `200 {"ok":true,"service":"pariksha-verse","environment":"..."}` — ready.
- `503 {"ok":false}` — **not ready.** The body never says _which_ component
  failed or why (that would be a configuration oracle for attackers). The
  failing component, error name, and message are logged server-side as
  `health.ready.failed` with the request id.

There is no third readiness dependency: the app has no cache, queue, or
external service dependency beyond D1 + configuration.

## 3. Structured logging — `src/lib/observability/logger.ts`

One JSON line per event through `console.info/warn/error`, captured by
Cloudflare Workers Logs in deployed Workers (`observability.enabled = true` in
`wrangler.jsonc`).

```json
{
  "timestamp": "2026-09-30T12:00:00.000Z",
  "level": "warn",
  "service": "pariksha-verse",
  "environment": "staging",
  "event": "rate_limit.blocked",
  "version": "0.1.0",
  "deployment": "<git commit sha>",
  "rule": "auth_sign_in_ip",
  "request_id": "8f5a9c2d1e3b4a67-SIN"
}
```

Callers log **events with flat primitive fields only**. The logger enforces a
redaction backstop: any field key matching
`token|secret|password|passwd|authorization|auth_key|cookie|session|email|hash|credential|api_key|access_key|private_key`
(case-insensitive) is emitted as `"[redacted]"`, non-primitive values become
`"[non-primitive]"`, strings are capped at 256 chars, and at most 24 fields are
emitted. This is a safety net, **not** permission to pass sensitive values.

### Event catalog

| Event                                                                                                        | Level      | Where                                          |
| ------------------------------------------------------------------------------------------------------------ | ---------- | ---------------------------------------------- |
| `auth.signin.requested` / `auth.signin.issued` / `auth.signin.account_not_found`                             | info/warn  | sign-in route                                  |
| `auth.createaccount.requested` / `.created` / `.issued`                                                      | info       | create-account route                           |
| `auth.verification.failed` (`reason`: `invalid_or_expired`, `email_mismatch`, `already_consumed_or_expired`) | warn       | verify route                                   |
| `auth.verification.failure`                                                                                  | error      | verify route internal error                    |
| `auth.verification.user_autocreated`                                                                         | info       | verify route (first sign-in creates the row)   |
| `auth.session.created` / `auth.session.revoked` / `auth.session.revoke_failed`                               | info/warn  | verify / sign-out / session-store              |
| `auth.demo.login` (fields: `slot`, `flow: staging_demo`)                                                     | info       | staging demo auth                              |
| `auth.guest_migration.completed` (`counts`) / `.failure`                                                     | info/error | migrate route                                  |
| `auth.email_delivery.failed` (`flow`)                                                                        | error      | sign-in / create-account                       |
| `rate_limit.blocked` (`rule`, `limiter: d1_fixed_window`, `retry_after_seconds`)                             | warn       | rate-limit 429s                                |
| `db.query.failure` (`scope`)                                                                                 | error      | e.g. `auth.session` D1 failure in `getSession` |
| `db.cleanup.failed` (`scope: user_sessions` / `verification_tokens`)                                         | warn       | opportunistic sweeps                           |
| `health.ready.failed` (`component`, `error_name`, `error_message`)                                           | error      | readiness probe                                |
| `api.<area>.failure` (`error_name`, `error_message`, `error_stack`)                                          | error      | centralized API error boundary                 |

### NEVER log (hard rule)

Magic-link tokens, verification-token hashes, session cookies or session IDs,
`SESSION_SECRET`, API keys, passwords, raw `Authorization` headers, request
bodies, full URLs with query parameters (tokens ride in query strings),
email addresses, IP addresses, question/answer or study content, and full
database records. The redaction pattern is the last line of defense — the
first is simply never passing such data to `logger`.

## 4. Request / correlation IDs — `src/lib/observability/request-id.ts`

- Resolved once per request in `src/middleware.ts`: the edge-attested
  **`cf-ray`** when Cloudflare provides it (clients cannot forge it), else a
  random UUID. Client-supplied `x-request-id` values are **never honored**.
- Returned to clients as the **`X-Request-ID`** response header on every
  middleware-handled response — support conversations can name a request with
  zero personal data involved.
- Forwarded to route handlers on the `x-request-id` request header (same
  propagation pattern as the CSP nonce); `apiErrorResponse` and the auth
  routes attach it to log entries.
- Not an authentication mechanism and never used for authorization.

## 5. Version / deployment identification

`scripts/generate-build-info.mjs` writes the gitignored
`src/lib/observability/build-info.generated.ts` (package.json version + `git
rev-parse HEAD`). It runs on `postinstall` and before every build (`build`,
`vinext:build`, `cf:build`), so:

- `/api/health` reports both values.
- Every structured log line carries `version` + `deployment`.
- Cloudflare additionally tags Workers Logs with its own per-deployment
  version id in the dashboard — use it to map log volume to a specific
  `wrangler versions` deployment.

## 6. Error handling — `src/lib/observability/api-error.ts`

Every API route catches failures and returns through `apiErrorResponse`:

- The client gets the route's **static generic message** (unchanged from
  Phase 14F) — never the exception, stack, SQL, or bindings.
- The server logs the event with `error_name`, truncated `error_message`
  (SQLite/D1 messages name constraints/tables, never binding values), and a
  truncated `error_stack` — all server-side only.
- The request id rides along, so a client-reported `X-Request-ID` maps
  directly to the error's log line.
- Deliberate exceptions stay hand-rolled: the mock-test **422
  `InsufficientQuestionsError`** response (domain detail is safe and useful)
  and sign-out's silent best-effort revocation (it must never reveal cookie
  validity).

### D1 failure behavior

Repositories throw; the route boundary catches. Any D1 failure therefore
becomes: `api.<area>.failure` error log (with request id) + generic JSON 5xx.
`getSession()` keeps its fail-closed semantics (D1 failure → `null`, treated
as logged-out) but now also emits `db.query.failure` with
`scope: "auth.session"` — a spike of these events means a D1 outage, not a
sign-out wave.

## 7. Operational smoke checks

Smoke checks are **not** a replacement for the full test suite.

**Local (dev server):**

```powershell
pnpm test:e2e -- tests/e2e/smoke.spec.ts
```

(Playwright starts `next dev` with the local D1 adapter; covers landing,
exam select, app shell, health, readiness, request IDs.)

**Staging (deployed):**

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://pariksha-verse-staging.desobuild.workers.dev"
$env:PLAYWRIGHT_TARGET = "staging"
pnpm test:e2e -- tests/e2e/staging/smoke.spec.ts tests/e2e/security-headers.spec.ts
```

**Production post-deployment (no users exist; no signup — read-only probes):**

```powershell
curl.exe -s https://parikshaverse.in/api/health
curl.exe -s https://parikshaverse.in/api/health/ready
curl.exe -s -o NUL -w "%{http_code}" https://parikshaverse.in/
curl.exe -s -o NUL -w "%{http_code}" https://parikshaverse.in/auth/sign-in
curl.exe -s -o NUL -w "%{http_code}" https://parikshaverse.in/exam/select
curl.exe -s -o NUL -w "%{http_code}" https://parikshaverse.in/app/home
curl.exe -s -o NUL -w "%{http_code}" https://parikshaverse.in/app/study
curl.exe -s -o NUL -w "%{http_code}" https://parikshaverse.in/app/practice
curl.exe -s -o NUL -w "%{http_code}" https://parikshaverse.in/app/mock-tests
curl.exe -s -o NUL -w "%{http_code}" https://parikshaverse.in/app/revision
curl.exe -s -o NUL -w "%{http_code}" https://parikshaverse.in/app/progress
```

Expected: health `ok:true` + `environment:production`; readiness 200; every
page 2xx/3xx (unauthenticated `/app/*` routes redirect into exam setup — that
is the designed behavior, not a failure). Then rerun the staging-style smoke
spec against the production base URL. **Do not** create users or enable
signup; authenticated-path validation happens in staging only.

## 8. Cloudflare dashboard configuration

Already in `wrangler.jsonc`: `observability.enabled = true` (Workers Logs with
console + invocation logs, inherited by staging/production envs). Nothing
else is force-enabled — vinext + the Vite Cloudflare plugin have no
additional observability surface, and third-party monitors are deliberately
not introduced.

After each deployment, verify once in the dashboard:

1. **Workers & Pages → pariksha-verse(-staging/-production) → Logs** — "Begin
   log stream" shows JSON lines with `service`, `environment`, `event`.
2. **Storage & Databases → D1 → pariksha-verse-db-\*→ Metrics** — check
   queries read/written and errors; sustained errors without API 5xx traffic
   usually indicates a migrations drift.
3. **Deployments** — note the deployment/version id; match it against
   `deployment` in `/api/health` (commit SHA) when correlating.

## 9. Investigation playbooks

**Health (`/api/health`) fails or returns 5xx:** the Worker itself is failing
to load or execute — check the latest deployment in Workers & Pages →
Deployments and roll back if needed; check Logs for startup/exception output;
verify the ASSETS binding and compatibility date were not changed.

**Readiness (`/api/health/ready`) returns 503:** the Worker runs but a
dependency is broken — filter Logs for `health.ready.failed`:
`component: "database"` → D1 binding issue or outage (check D1 metrics, the
binding name `DB`, and that migrations were applied); `component:
"configuration"` → `SESSION_SECRET` missing/weak/wrong for that environment
(check `wrangler secret list` for the deployed environment).

**Authentication fails (staging/production):** filter Logs by
`auth.` events and the user-reported `X-Request-ID`:
`auth.email_delivery.failed` → email provider issue (verify the provider
secret/config for that environment); `auth.verification.failed` with
`invalid_or_expired`/`already_consumed_or_expired` → user-side token expiry
or reuse, expected behavior; `auth.verification.failure` (error level) →
internal fault, inspect `error_message`/`error_stack`; `rate_limit.blocked`
with the auth rules → the client tripped Phase 14E limits (expected; verify
`retry-after`); bursts of `db.query.failure` (`scope: "auth.session"`) → D1
problem, follow the D1 playbook. Never ask the user for their token, cookie,
or email in log-related debugging — the logs intentionally do not contain
them.

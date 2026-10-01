import { NextResponse } from "next/server";
import { resolveEnvironment } from "@/lib/observability/logger";
import { APP_COMMIT_SHA, APP_VERSION } from "@/lib/observability/version";

/**
 * Phase 14G — liveness / diagnostics endpoint.
 *
 * Answers exactly one question: is the Worker runtime up and serving? It
 * executes no queries and reads no bindings beyond the process environment,
 * so it is deterministic and adds no load to D1 — Cloudflare health checks
 * and post-deployment smoke tests can hit it freely.
 *
 * The response is intentionally minimal and exposes nothing sensitive: no
 * secrets, no binding objects, no database configuration, no users, no
 * internals. `version`/`deployment` are the public build identifiers from
 * src/lib/observability/version.ts (package.json version + build commit).
 *
 * Deeper operational checks live in GET /api/health/ready, which verifies the
 * configuration and D1 dependencies the application actually requires.
 *
 * The `status` field is retained alongside `ok` for the Phase 14F contract
 * asserted by tests/e2e/security-headers.spec.ts (`status === "healthy"`).
 */

const SERVICE_NAME = "pariksha-verse";

export async function GET() {
  // Reaching this handler at all means the Worker parsed, loaded the RSC
  // entry and executed the route — the runtime is functioning. Nothing after
  // this point can meaningfully "fail" without the framework returning its
  // own 5xx, but we keep the shape stable regardless.
  return NextResponse.json({
    ok: true,
    status: "healthy",
    service: SERVICE_NAME,
    environment: resolveEnvironment(),
    version: APP_VERSION,
    deployment: APP_COMMIT_SHA,
  });
}

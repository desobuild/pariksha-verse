import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { getSessionSecret } from "@/lib/auth/crypto-session";
import { logger, resolveEnvironment } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";

/**
 * Phase 14G — readiness / runtime diagnostics endpoint.
 *
 * Complements the liveness probe (GET /api/health): it verifies the two
 * dependencies this application actually requires to serve real traffic —
 * nothing invented for infrastructure this app does not have:
 *
 * 1. Database: one deterministic `SELECT 1` through the normal getDb()
 *    resolution path. On the deployed Worker that exercises the real D1
 *    binding; in local Node runtimes the dev adapter is used. This is the
 *    only query the endpoint ever runs.
 * 2. Auth configuration: SESSION_SECRET resolves for this environment
 *    (crypto-session fails closed in staging/production when it is missing,
 *    the known dev value, or under 32 chars).
 *
 * The public response is deliberately generic: `ok` plus the same non-secret
 * identification fields as /api/health. WHICH check failed is never exposed —
 * that detail (and the underlying error) goes to the structured server log
 * tagged with the request id, keeping the endpoint from becoming a
 * configuration probe for attackers. A 503 means "deployment not ready",
 * which is what post-deployment validation (Phase 14H) and dashboards need.
 */

const SERVICE_NAME = "pariksha-verse";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const failures: string[] = [];

  try {
    const db = getDb();
    await db.get(sql`SELECT 1`);
  } catch (error) {
    failures.push("database");
    // Server-side detail only: error name/message, never SQL text, bindings,
    // or stack-traced responses to the client.
    logger.error("health.ready.failed", {
      component: "database",
      error_name: error instanceof Error ? error.name : "UnknownError",
      error_message: error instanceof Error ? error.message : undefined,
      request_id: requestId,
    });
  }

  try {
    getSessionSecret();
  } catch (error) {
    failures.push("configuration");
    logger.error("health.ready.failed", {
      component: "configuration",
      error_name: error instanceof Error ? error.name : "UnknownError",
      request_id: requestId,
    });
  }

  if (failures.length > 0) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    service: SERVICE_NAME,
    environment: resolveEnvironment(),
  });
}

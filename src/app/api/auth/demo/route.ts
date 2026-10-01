import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { issueSession } from "@/lib/auth/session-store";
import { createSessionCookie } from "@/lib/auth/session";
import {
  ensureStagingDemoWorkspace,
  isStagingDemoAuthEnabled,
  resolveStagingDemoIdentity,
  upsertStagingDemoUser,
} from "@/lib/auth/staging-demo-auth";
import {
  AUTH_RATE_LIMIT_RULES,
  enforceRateLimit,
  getClientIp,
  isRateLimitingEnabled,
  rateLimitExceededResponse,
} from "@/lib/auth/rate-limit";
import { logger } from "@/lib/observability/logger";
import { apiErrorResponse } from "@/lib/observability/api-error";
import { getRequestId } from "@/lib/observability/request-id";

/**
 * Phase 13A.3 — Staging-only demo authentication endpoint.
 *
 * Fails closed (404) in every environment except staging, decided purely from
 * trusted server-side configuration. Issues the SAME pv_session cookie used by
 * the production magic-link flow — no verification tokens, no second session
 * mechanism, and no token ever appears in the response body.
 *
 * Phase 14E: sessions are server-side revocable records (logout works), and
 * the endpoint is IP rate-limited to prevent uncontrolled session-minting
 * abuse. The 404 gate runs first so limited/non-staging requests are
 * indistinguishable from a non-existent endpoint.
 */

// Strict: any attempt to smuggle userId/email/workspace/environment claims is rejected.
const stagingDemoAuthSchema = z
  .object({
    slot: z.string().max(32).optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (!isStagingDemoAuthEnabled()) {
    // Endpoint simply does not exist outside staging.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // Phase 14E: fixed Friend 1–5 roster is unchanged, but minting sessions is
    // now bounded per client IP.
    if (isRateLimitingEnabled()) {
      const db = getDb();
      const ipLimit = await enforceRateLimit(
        db,
        AUTH_RATE_LIMIT_RULES.demoIp,
        getClientIp(request)
      );
      if (!ipLimit.allowed)
        return rateLimitExceededResponse(ipLimit, { request, rule: AUTH_RATE_LIMIT_RULES.demoIp });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = stagingDemoAuthSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid demo authentication request" }, { status: 400 });
    }

    // Identity is derived exclusively from the fixed server-side roster;
    // the client may only choose a slot.
    const identity = resolveStagingDemoIdentity(parsed.data.slot);
    if (!identity) {
      return NextResponse.json({ error: "Unknown demo profile" }, { status: 400 });
    }

    const db = getDb();
    const user = await upsertStagingDemoUser(db, identity);
    const workspace = await ensureStagingDemoWorkspace(db, user.id);

    // Normal secure session: SESSION_SECRET HMAC signing, 30-day expiry,
    // HttpOnly + SameSite=Lax (+ Secure on HTTPS) via the shared cookie builder,
    // backed by a server-side revocable session record.
    const session = await issueSession(db, user.id, user.email);

    // Phase 14G: the event name itself marks this as staging-only demo
    // behavior. The slot id is a fixed roster identifier (no user data); the
    // demo user's email is deliberately NOT logged.
    logger.info("auth.demo.login", {
      request_id: getRequestId(request),
      slot: parsed.data.slot ?? "default",
      flow: "staging_demo",
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        createdAt:
          user.createdAt instanceof Date ? user.createdAt.getTime() : Number(user.createdAt),
      },
      workspaceId: workspace?.id ?? null,
    });
    response.headers.set("Set-Cookie", createSessionCookie(session.token, request));
    return response;
  } catch (error) {
    return apiErrorResponse({
      event: "auth.demo.failure",
      error,
      request,
      message: "Demo authentication failed",
    });
  }
}

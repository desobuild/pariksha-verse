import { lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import { rateLimitBuckets } from "@/db/schema";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { logger } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";

/**
 * Phase 14E (PART E) — server-side rate limiting for authentication endpoints.
 *
 * D1-backed fixed-window counters. Each check is a single atomic upsert
 * (INSERT … ON CONFLICT DO UPDATE count = count + 1 RETURNING count), so the
 * count read back is authoritative even under concurrency — no client input,
 * storage, or header is ever trusted for the decision. Window rollover is
 * implicit: `window_start` is part of the primary key, so a new window starts
 * a fresh counter and old windows are garbage-collected.
 *
 * The local test-auth escape hatch (ENABLE_TEST_AUTH_MOCK=true — the same
 * trusted server-side flag that gates the sanctioned _testToken field) also
 * disables limiting, so local/E2E sign-in flows behave exactly as before.
 * Staging and production run with the flag false and are always limited.
 */

export interface RateLimitRule {
  /** Bucket namespace, e.g. "auth_verify_ip". */
  name: string;
  /** Maximum allowed requests per window (inclusive). */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests still allowed within the current window. */
  remaining: number;
  /** Seconds until the window resets (for Retry-After). */
  retryAfterSeconds: number;
}

/** Windows are 10 minutes; closed windows are swept after 2 hours. */
const RATE_LIMIT_RETENTION_SECONDS = 2 * 60 * 60;

export const AUTH_RATE_LIMIT_RULES = {
  signInIp: { name: "auth_sign_in_ip", limit: 10, windowSeconds: 600 } satisfies RateLimitRule,
  signInEmail: { name: "auth_sign_in_email", limit: 5, windowSeconds: 600 } satisfies RateLimitRule,
  createAccountIp: {
    name: "auth_create_account_ip",
    limit: 10,
    windowSeconds: 600,
  } satisfies RateLimitRule,
  createAccountEmail: {
    name: "auth_create_account_email",
    limit: 5,
    windowSeconds: 600,
  } satisfies RateLimitRule,
  verifyIp: { name: "auth_verify_ip", limit: 20, windowSeconds: 600 } satisfies RateLimitRule,
  verifyEmail: { name: "auth_verify_email", limit: 10, windowSeconds: 600 } satisfies RateLimitRule,
  demoIp: { name: "auth_demo_ip", limit: 60, windowSeconds: 600 } satisfies RateLimitRule,
} as const;

/**
 * Whether endpoint rate limiting is active. Mirrors the auth routes' trusted
 * server-side ENABLE_TEST_AUTH_MOCK resolution: the flag exists for local
 * magic-link testing and is false in staging/production vars.
 */
export function isRateLimitingEnabled(): boolean {
  const isServerOrTest =
    typeof window === "undefined" || !!process.env.VITEST || process.env.NODE_ENV === "test";
  const cfEnv = isServerOrTest ? getCloudflareEnv() : {};
  const flag = cfEnv.ENABLE_TEST_AUTH_MOCK || process.env.ENABLE_TEST_AUTH_MOCK;
  return flag !== "true";
}

/**
 * Best-effort client IP for bucketing. On Cloudflare, CF-Connecting-IP is set
 * by the edge and cannot be spoofed by the client; the fallbacks cover local
 * development. Unparseable/absent addresses collapse into a single shared
 * "unknown" bucket, which errs toward stricter limiting.
 */
export function getClientIp(request: Request): string {
  const headerIp = (name: string): string | null => {
    const raw = request.headers.get(name);
    if (!raw) return null;
    const candidate = raw.split(",")[0]?.trim() ?? "";
    // IPs are digits/dots (v4) or hex/colons (v6), at most 45 chars.
    if (!/^[0-9a-fA-F:.]{1,45}$/.test(candidate)) return null;
    return candidate;
  };

  return (
    headerIp("cf-connecting-ip") ??
    headerIp("x-real-ip") ??
    headerIp("x-forwarded-for") ??
    "unknown"
  );
}

/**
 * Records one request against the rule/identifier bucket and decides whether
 * the request is within the limit. Throws on storage failure (the endpoint
 * cannot authenticate against an unhealthy D1 anyway).
 */
export async function enforceRateLimit(
  db: DatabaseInstance,
  rule: RateLimitRule,
  identifier: string
): Promise<RateLimitResult> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowSeconds = rule.windowSeconds;
  const windowStart = Math.floor(nowSec / windowSeconds) * windowSeconds;
  const key = `${rule.name}:${identifier}`;

  const rows = await db
    .insert(rateLimitBuckets)
    .values({ key, windowStart, count: 1, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.key, rateLimitBuckets.windowStart],
      set: { count: sql`${rateLimitBuckets.count} + 1`, updatedAt: new Date() },
    })
    .returning({ count: rateLimitBuckets.count });

  const count = rows[0]?.count ?? 1;

  // The request that opened a fresh window sweeps closed ones, keeping the
  // table bounded without paying for a DELETE on every request.
  if (count === 1) {
    await db
      .delete(rateLimitBuckets)
      .where(lt(rateLimitBuckets.windowStart, nowSec - RATE_LIMIT_RETENTION_SECONDS));
  }

  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: Math.max(1, windowStart + windowSeconds - nowSec),
  };
}

/**
 * Uniform 429 body for limited requests. Reveals no internal state beyond the
 * standard Retry-After hint; the message is identical for every rule.
 *
 * Phase 14G: also emits the `rate_limit.blocked` event with safe metadata
 * only — rule name (route/category), limiter type, and the request id when
 * the caller passes the request. The bucketed identifier (client IP or
 * submitted email) is deliberately NOT logged: the privacy model keeps raw
 * IPs and email addresses out of log lines, and the rule name plus request id
 * are sufficient to correlate a block with the request's other events.
 */
export function rateLimitExceededResponse(
  result: RateLimitResult,
  context?: { request?: Request; rule?: RateLimitRule }
): Response {
  logger.warn("rate_limit.blocked", {
    rule: context?.rule?.name,
    limiter: "d1_fixed_window",
    retry_after_seconds: result.retryAfterSeconds,
    request_id: context?.request ? getRequestId(context.request) : undefined,
  });

  return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(result.retryAfterSeconds),
    },
  });
}

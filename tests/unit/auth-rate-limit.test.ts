import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestD1Database } from "./db-test-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { DatabaseInstance } from "@/db";
import { rateLimitBuckets } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  AUTH_RATE_LIMIT_RULES,
  enforceRateLimit,
  getClientIp,
  isRateLimitingEnabled,
} from "@/lib/auth/rate-limit";
import { TestEmailProvider, setEmailProvider } from "@/lib/email/email-service";
import { POST as signInHandler } from "@/app/api/auth/sign-in/route";
import { POST as verifyHandler } from "@/app/api/auth/verify/route";
import type { CloudflareEnv } from "@/types/cloudflare";

/**
 * Phase 14E (PART E) — server-side rate limiting on auth endpoints.
 *
 * Counters live in D1 and are enforced with an atomic upsert: the decision is
 * made entirely server-side, buckets are independent per identifier and per
 * rule, and closed windows are swept automatically.
 */

const SECRET = "test_vitest_mock_session_secret_32b_min_length";
const BASE = "http://localhost:3000";

function jsonRequest(path: string, body: unknown, ip?: string): Request {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ip ? { "cf-connecting-ip": ip } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("Phase 14E — auth endpoint rate limiting", () => {
  let db: DatabaseInstance;
  const originalEnv = { ...process.env };
  const originalCfEnv = globalThis.__CLOUDFLARE_ENV__;

  beforeEach(async () => {
    const d1 = createTestD1Database();
    globalThis.__CLOUDFLARE_ENV__ = { DB: d1 } as unknown as CloudflareEnv;
    db = drizzle(d1, { schema });

    setEmailProvider(new TestEmailProvider());
    process.env.SESSION_SECRET = SECRET;
    // Limiter ON by default (staging/production posture).
    delete process.env.ENABLE_TEST_AUTH_MOCK;
  });

  afterEach(() => {
    setEmailProvider(null);
    process.env = { ...originalEnv };
    globalThis.__CLOUDFLARE_ENV__ = originalCfEnv;
  });

  it("1. requests below the limit are allowed and report remaining allowance", async () => {
    const rule = AUTH_RATE_LIMIT_RULES.signInEmail;

    for (let i = 1; i <= rule.limit; i++) {
      const result = await enforceRateLimit(db, rule, "student@example.com");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(rule.limit - i);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it("2. the request beyond the limit is rejected", async () => {
    const rule = AUTH_RATE_LIMIT_RULES.signInEmail;

    for (let i = 0; i < rule.limit; i++) {
      const result = await enforceRateLimit(db, rule, "student@example.com");
      expect(result.allowed).toBe(true);
    }

    const blocked = await enforceRateLimit(db, rule, "student@example.com");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("3. buckets are independent per identifier", async () => {
    const rule = AUTH_RATE_LIMIT_RULES.signInIp;

    for (let i = 0; i < rule.limit; i++) {
      await enforceRateLimit(db, rule, "203.0.113.1");
    }
    // Exhausted bucket does not affect a different client...
    const otherClient = await enforceRateLimit(db, rule, "203.0.113.2");
    expect(otherClient.allowed).toBe(true);

    // ...nor a different rule namespace for the same identifier.
    const otherRule = await enforceRateLimit(db, AUTH_RATE_LIMIT_RULES.verifyIp, "203.0.113.1");
    expect(otherRule.allowed).toBe(true);
  });

  it("4. rate-limit state expires: window rollover resets counts and old windows are swept", async () => {
    const rule = AUTH_RATE_LIMIT_RULES.signInEmail;

    for (let i = 0; i < rule.limit; i++) {
      await enforceRateLimit(db, rule, "student@example.com");
    }
    expect((await enforceRateLimit(db, rule, "student@example.com")).allowed).toBe(false);

    // Close the current window by back-dating it beyond the 2h sweep horizon,
    // then retry: the new window allows again and the closed window record is
    // gone (swept by the request that opened the fresh window).
    await db
      .update(rateLimitBuckets)
      .set({ windowStart: Math.floor(Date.now() / 1000) - 2 * 60 * 60 - 60 })
      .where(eq(rateLimitBuckets.key, `${rule.name}:student@example.com`));

    const nextWindow = await enforceRateLimit(db, rule, "student@example.com");
    expect(nextWindow.allowed).toBe(true);

    const rows = await db.select().from(rateLimitBuckets);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(1);
  });

  it("5. CF-Connecting-IP is preferred for bucketing; unparseable IPs fall back safely", () => {
    const withCf = new Request(`${BASE}/api/auth/sign-in`, {
      headers: { "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "10.0.0.1" },
    });
    expect(getClientIp(withCf)).toBe("198.51.100.7");

    const forwarded = new Request(`${BASE}/api/auth/sign-in`, {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.2" },
    });
    expect(getClientIp(forwarded)).toBe("203.0.113.9");

    const junk = new Request(`${BASE}/api/auth/sign-in`, {
      headers: { "cf-connecting-ip": "not an ip; drop table" },
    });
    expect(getClientIp(junk)).toBe("unknown");

    const none = new Request(`${BASE}/api/auth/sign-in`);
    expect(getClientIp(none)).toBe("unknown");
  });

  it("6. sign-in returns 429 with Retry-After once the per-email limit is exceeded", async () => {
    process.env.ENABLE_TEST_AUTH_MOCK = "false";
    const email = "flood@example.com";
    await db.insert((await import("@/db/schema")).users).values({
      id: "usr_flood",
      email,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const rule = AUTH_RATE_LIMIT_RULES.signInEmail;
    for (let i = 0; i < rule.limit; i++) {
      const res = await signInHandler(jsonRequest("/api/auth/sign-in", { email }, "198.51.100.9"));
      expect(res.status).toBe(200);
    }

    const blocked = await signInHandler(jsonRequest("/api/auth/sign-in", { email }, "198.51.100.9"));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    const body = (await blocked.json()) as { error?: string };
    expect(body.error).toBe("Too many requests. Please try again later.");
  });

  it("7. verification is rate-limited server-side per client IP", async () => {
    process.env.ENABLE_TEST_AUTH_MOCK = "false";
    const rule = AUTH_RATE_LIMIT_RULES.verifyIp;

    // Distinct emails per attempt keep the per-email bucket out of the
    // picture: only the per-IP bucket accumulates. Invalid tokens still
    // consume budget — the first `limit` attempts get the generic 401, then
    // the endpoint starts answering 429.
    for (let i = 0; i < rule.limit; i++) {
      const res = await verifyHandler(
        jsonRequest(
          "/api/auth/verify",
          { email: `x${i}@example.com`, token: "bad.token" },
          "198.51.100.21"
        )
      );
      expect(res.status).toBe(401);
    }
    const limited = await verifyHandler(
      jsonRequest(
        "/api/auth/verify",
        { email: `x${rule.limit}@example.com`, token: "bad.token" },
        "198.51.100.21"
      )
    );
    expect(limited.status).toBe(429);

    // A different client IP still gets normal (401) handling.
    const otherClient = await verifyHandler(
      jsonRequest(
        "/api/auth/verify",
        { email: "other@example.com", token: "bad.token" },
        "198.51.100.22"
      )
    );
    expect(otherClient.status).toBe(401);
  });

  it("8. the demo endpoint bucket blocks beyond its limit", async () => {
    const rule = AUTH_RATE_LIMIT_RULES.demoIp;

    for (let i = 0; i < rule.limit; i++) {
      const result = await enforceRateLimit(db, rule, "198.51.100.30");
      expect(result.allowed).toBe(true);
    }
    const blocked = await enforceRateLimit(db, rule, "198.51.100.30");
    expect(blocked.allowed).toBe(false);
  });

  it("9. limiting is disabled only under the local test-auth flag", () => {
    process.env.ENABLE_TEST_AUTH_MOCK = "true";
    expect(isRateLimitingEnabled()).toBe(false);

    process.env.ENABLE_TEST_AUTH_MOCK = "false";
    expect(isRateLimitingEnabled()).toBe(true);

    delete process.env.ENABLE_TEST_AUTH_MOCK;
    expect(isRateLimitingEnabled()).toBe(true);
  });
});

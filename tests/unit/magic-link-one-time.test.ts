import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestD1Database } from "./db-test-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { DatabaseInstance } from "@/db";
import { users, exams, examAttempts, verificationTokens, userSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { signToken } from "@/lib/auth/crypto-session";
import {
  recordVerificationTokenIssued,
  consumeVerificationToken,
  hashToken,
} from "@/lib/auth/verification-tokens";
import { TestEmailProvider, setEmailProvider } from "@/lib/email/email-service";
import { POST as signInHandler } from "@/app/api/auth/sign-in/route";
import { POST as verifyHandler } from "@/app/api/auth/verify/route";
import { GET as sessionHandler } from "@/app/api/auth/session/route";
import { getSession, extractCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { CloudflareEnv } from "@/types/cloudflare";

/**
 * Phase 14E (PART B) — magic-link tokens are one-time-use.
 *
 * A valid token creates exactly one session, ever. Replay (sequential or
 * concurrent) fails with the same generic response as an invalid token, and
 * the database only ever stores a digest of the token — never the raw value.
 */

const SECRET = "test_vitest_mock_session_secret_32b_min_length";
const BASE = "http://localhost:3000";

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Phase 14E — one-time magic-link tokens", () => {
  let db: DatabaseInstance;
  const originalEnv = { ...process.env };
  const originalCfEnv = globalThis.__CLOUDFLARE_ENV__;

  beforeEach(async () => {
    const d1 = createTestD1Database();
    globalThis.__CLOUDFLARE_ENV__ = { DB: d1 } as unknown as CloudflareEnv;
    db = drizzle(d1, { schema });

    setEmailProvider(new TestEmailProvider());
    process.env.SESSION_SECRET = SECRET;
    process.env.ENABLE_TEST_AUTH_MOCK = "true";

    await db.insert(exams).values({
      id: "exam_neet",
      name: "NEET",
      shortName: "NEET",
      slug: "neet",
      category: "medical",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(examAttempts).values({
      id: "attempt_neet_2027",
      examId: "exam_neet",
      slug: "neet-2027",
      label: "NEET 2027",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(users).values({
      id: "usr_ml_student",
      email: "student@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => {
    setEmailProvider(null);
    process.env = { ...originalEnv };
    globalThis.__CLOUDFLARE_ENV__ = originalCfEnv;
  });

  /** Signs in through the route and returns the sanctioned test token. */
  async function issueTokenViaSignIn(email: string): Promise<string> {
    const res = await signInHandler(jsonRequest("/api/auth/sign-in", { email }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { _testToken?: string };
    expect(typeof body._testToken).toBe("string");
    return body._testToken as string;
  }

  it("1. a valid token verifies into an authenticated session", async () => {
    const token = await issueTokenViaSignIn("student@example.com");

    const res = await verifyHandler(
      jsonRequest("/api/auth/verify", { email: "student@example.com", token })
    );
    expect(res.status).toBe(200);

    const cookie = res.headers.get("Set-Cookie") ?? "";
    const session = await getSession(
      new Request(`${BASE}/api/auth/session`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${extractCookie(cookie, SESSION_COOKIE_NAME)}` },
      })
    );
    expect(session?.user.email).toBe("student@example.com");
  });

  it("2. the same token succeeds only once — replay is rejected", async () => {
    const token = await issueTokenViaSignIn("student@example.com");
    const payload = { email: "student@example.com", token };

    const first = await verifyHandler(jsonRequest("/api/auth/verify", payload));
    expect(first.status).toBe(200);

    const replay = await verifyHandler(jsonRequest("/api/auth/verify", payload));
    expect(replay.status).toBe(401);
    const body = (await replay.json()) as { error?: string };
    expect(body.error).toBeTruthy();
    // Replay gets no session cookie.
    expect(replay.headers.get("Set-Cookie")).toBeNull();
  });

  it("3. a replayed token cannot create another session", async () => {
    const token = await issueTokenViaSignIn("student@example.com");
    const payload = { email: "student@example.com", token };

    expect((await verifyHandler(jsonRequest("/api/auth/verify", payload))).status).toBe(200);

    const sessionsBefore = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, "usr_ml_student"));
    expect(sessionsBefore).toHaveLength(1);

    const replay = await verifyHandler(jsonRequest("/api/auth/verify", payload));
    expect(replay.status).toBe(401);

    const sessionsAfter = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, "usr_ml_student"));
    expect(sessionsAfter).toHaveLength(1);
  });

  it("4. an expired token record is rejected even with a valid signature", async () => {
    const token = await issueTokenViaSignIn("student@example.com");

    // Age the server-side record past its expiry (the signed exp is still in
    // the future, so this isolates the record-expiry check).
    const tokenHash = await hashToken(token);
    await db
      .update(verificationTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(verificationTokens.tokenHash, tokenHash));

    const consumed = await consumeVerificationToken(db, token);
    expect(consumed).toBe(false);

    const res = await verifyHandler(
      jsonRequest("/api/auth/verify", { email: "student@example.com", token })
    );
    expect(res.status).toBe(401);
  });

  it("5. an invalid or never-issued token is rejected", async () => {
    // Garbage token.
    const garbage = await verifyHandler(
      jsonRequest("/api/auth/verify", { email: "student@example.com", token: "junk.junk" })
    );
    expect(garbage.status).toBe(401);

    // Validly signed token that was never issued through sign-in: with no
    // server-side record it must fail closed (the old "any valid signature
    // works" behavior is gone).
    const forgedButSigned = await signToken({
      email: "student@example.com",
      purpose: "magic_link",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    const neverIssued = await verifyHandler(
      jsonRequest("/api/auth/verify", { email: "student@example.com", token: forgedButSigned })
    );
    expect(neverIssued.status).toBe(401);
  });

  it("6. concurrent verification allows exactly one successful consumption", async () => {
    const token = await issueTokenViaSignIn("student@example.com");

    const attempts = await Promise.all(
      Array.from({ length: 6 }, () => consumeVerificationToken(db, token))
    );
    expect(attempts.filter(Boolean)).toHaveLength(1);
    expect(attempts.filter((a) => !a)).toHaveLength(5);

    // Same guarantee through the HTTP endpoint under concurrency.
    const token2 = await issueTokenViaSignIn("student@example.com");
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        verifyHandler(jsonRequest("/api/auth/verify", { email: "student@example.com", token: token2 }))
      )
    );
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 401)).toHaveLength(5);
  });

  it("7. stored records contain only a digest — never the raw token", async () => {
    const token = await issueTokenViaSignIn("student@example.com");

    const rows = await db.select().from(verificationTokens);
    expect(rows).toHaveLength(1);
    const record = rows[0];

    expect(record.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(record.tokenHash).not.toBe(token);
    expect(record.consumedAt).toBeNull();
    expect(record.consumedNonce).toBeNull();
    expect(record.email).toBe("student@example.com");

    // The raw token string appears nowhere in the record.
    expect(JSON.stringify(record)).not.toContain(token);
  });

  it("8. auth responses never return the raw token or its digest", async () => {
    const token = await issueTokenViaSignIn("student@example.com");

    const res = await verifyHandler(
      jsonRequest("/api/auth/verify", { email: "student@example.com", token })
    );
    const raw = await res.text();
    expect(raw).not.toContain(token);

    const tokenHash = await hashToken(token);
    expect(raw).not.toContain(tokenHash);

    // Session endpoint exposes identity only.
    const cookie = res.headers.get("Set-Cookie") ?? "";
    const sessionRes = await sessionHandler(
      new Request(`${BASE}/api/auth/session`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${extractCookie(cookie, SESSION_COOKIE_NAME)}` },
      })
    );
    const sessionRaw = (await sessionRes.text()).toLowerCase();
    expect(sessionRaw).not.toContain("token");
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestD1Database } from "./db-test-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { DatabaseInstance } from "@/db";
import { users, exams, examAttempts, userSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { issueSession, revokeSession, cleanupSessions } from "@/lib/auth/session-store";
import { getSession, createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { POST as signOutHandler } from "@/app/api/auth/sign-out/route";
import { GET as sessionHandler } from "@/app/api/auth/session/route";
import type { CloudflareEnv } from "@/types/cloudflare";

/**
 * Phase 14E (PART D) — server-side session lifecycle & revocation.
 *
 * Logout invalidates the session server-side: a stolen/replayed cookie stops
 * working the moment its record is revoked. Cookie behavior (Secure on HTTPS,
 * no Secure on localhost HTTP) is unchanged.
 */

const SECRET = "test_vitest_mock_session_secret_32b_min_length";
const BASE = "http://localhost:3000";

function cookieRequest(path: string, cookieValue: string, base = BASE): Request {
  return new Request(`${base}${path}`, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${cookieValue}` },
  });
}

describe("Phase 14E — session lifecycle & revocation", () => {
  let db: DatabaseInstance;
  const originalEnv = { ...process.env };
  const originalCfEnv = globalThis.__CLOUDFLARE_ENV__;

  beforeEach(async () => {
    const d1 = createTestD1Database();
    globalThis.__CLOUDFLARE_ENV__ = { DB: d1 } as unknown as CloudflareEnv;
    db = drizzle(d1, { schema });

    process.env.SESSION_SECRET = SECRET;

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
      id: "usr_sess_student",
      email: "student@example.com",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.__CLOUDFLARE_ENV__ = originalCfEnv;
  });

  it("1. a valid session authenticates", async () => {
    const issued = await issueSession(db, "usr_sess_student", "student@example.com");
    const session = await getSession(
      cookieRequest("/api/auth/session", issued.token),
      db
    );
    expect(session?.user.id).toBe("usr_sess_student");
    expect(session?.user.email).toBe("student@example.com");
    expect(session?.expiresAt).toBe(issued.expiresAt);
  });

  it("2. an expired session record fails even while the signature is still valid", async () => {
    const issued = await issueSession(db, "usr_sess_student", "student@example.com");

    // Age the record (the signed exp remains in the future — this isolates
    // the server-side expiry check).
    await db
      .update(userSessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(userSessions.id, issued.sessionId));

    const session = await getSession(cookieRequest("/api/auth/session", issued.token), db);
    expect(session).toBeNull();
  });

  it("3. a revoked session fails", async () => {
    const issued = await issueSession(db, "usr_sess_student", "student@example.com");
    await revokeSession(db, issued.sessionId);

    const session = await getSession(cookieRequest("/api/auth/session", issued.token), db);
    expect(session).toBeNull();
  });

  it("4. logout revokes the session server-side and clears the cookie", async () => {
    const issued = await issueSession(db, "usr_sess_student", "student@example.com");

    const res = await signOutHandler(cookieRequest("/api/auth/sign-out", issued.token));
    expect(res.status).toBe(200);

    const clearCookie = res.headers.get("Set-Cookie") ?? "";
    expect(clearCookie).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(clearCookie).toContain("Max-Age=0");

    // The same cookie value can no longer authenticate.
    const session = await getSession(cookieRequest("/api/auth/session", issued.token), db);
    expect(session).toBeNull();
  });

  it("5. a revoked cookie cannot recreate auth through the session endpoint", async () => {
    const issued = await issueSession(db, "usr_sess_student", "student@example.com");
    await revokeSession(db, issued.sessionId);

    const res = await sessionHandler(cookieRequest("/api/auth/session", issued.token));
    const body = (await res.json()) as { user: unknown };
    expect(body.user).toBeNull();
  });

  it("6. logout without a valid cookie is a safe no-op", async () => {
    const res = await signOutHandler(cookieRequest("/api/auth/sign-out", "junk.junk"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("7. local HTTP requests keep a non-Secure cookie", async () => {
    const issued = await issueSession(db, "usr_sess_student", "student@example.com");
    const header = createSessionCookie(issued.token, new Request(`${BASE}/api/auth/session`));
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).not.toContain("Secure");

    // And the session still resolves in the local (HTTP) shape.
    const session = await getSession(cookieRequest("/api/auth/session", issued.token), db);
    expect(session).not.toBeNull();
  });

  it("8. HTTPS requests keep the Secure cookie flag", async () => {
    const issued = await issueSession(db, "usr_sess_student", "student@example.com");
    const header = createSessionCookie(
      issued.token,
      new Request("https://parikshaverse.in/api/auth/session")
    );
    expect(header).toContain("; Secure");
  });

  it("9. cleanup removes expired/revoked records and keeps live ones", async () => {
    const live = await issueSession(db, "usr_sess_student", "student@example.com");

    // Stale rows: one long expired, one revoked long ago.
    await db.insert(userSessions).values({
      id: "ses_old_expired",
      userId: "usr_sess_student",
      expiresAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    });
    await db.insert(userSessions).values({
      id: "ses_old_revoked",
      userId: "usr_sess_student",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      revokedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    });

    await cleanupSessions(db);

    const rows = await db.select().from(userSessions);
    expect(rows.map((r) => r.id)).toEqual([live.sessionId]);
  });
});

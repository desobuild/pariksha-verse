import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestD1Database } from "./db-test-adapter";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { DatabaseInstance } from "@/db";
import type { CloudflareEnv } from "@/types/cloudflare";
import {
  users,
  userWorkspaces,
  exams,
  examAttempts,
  subjects,
  chapters,
  topics,
  plannerTasks,
  userTopicProgress,
  mockTests,
  mockTestSessions,
  mockTestResults,
} from "@/db/schema";
import { getSession, extractCookie, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { verifyToken, type SessionTokenPayload } from "@/lib/auth/crypto-session";
import { TestEmailProvider, setEmailProvider } from "@/lib/email/email-service";
import { STAGING_DEMO_IDENTITIES } from "@/lib/auth/staging-demo-auth";
import { mockTestRepository } from "@/repositories/mock-test.repository";
import { POST as demoHandler } from "@/app/api/auth/demo/route";
import { GET as sessionHandler } from "@/app/api/auth/session/route";
import { POST as migrateHandler } from "@/app/api/auth/migrate/route";
import { GET as workspacesHandler } from "@/app/api/workspaces/route";

const STAGING_SECRET = "test_vitest_mock_session_secret_32b_min_length";
const STAGING_URL = "https://staging.parikshaverse.in";
const DEMO_URL = `${STAGING_URL}/api/auth/demo`;

function demoRequest(body: unknown): Request {
  return new Request(DEMO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function authedRequest(path: string, setCookieOrToken: string): Request {
  const token = setCookieOrToken.includes(";")
    ? (extractCookie(setCookieOrToken, SESSION_COOKIE_NAME) ?? "")
    : setCookieOrToken;
  return new Request(`${STAGING_URL}${path}`, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
  });
}

describe("Phase 13A.3 — Staging Demo Authentication", () => {
  let db: DatabaseInstance;
  let currentD1: D1Database;
  let testEmailProvider: TestEmailProvider;
  const originalEnv = { ...process.env };
  const originalCfEnv = globalThis.__CLOUDFLARE_ENV__;

  function setEnvironment(env?: string, extra: Record<string, string> = {}) {
    globalThis.__CLOUDFLARE_ENV__ = {
      DB: currentD1,
      ...(env ? { ENVIRONMENT: env } : {}),
      ...extra,
    } as unknown as CloudflareEnv;
  }

  beforeEach(async () => {
    currentD1 = createTestD1Database();
    // Default test environment has NO ENVIRONMENT: demo auth must be disabled.
    globalThis.__CLOUDFLARE_ENV__ = { DB: currentD1 } as unknown as CloudflareEnv;
    db = drizzle(currentD1, { schema });

    testEmailProvider = new TestEmailProvider();
    setEmailProvider(testEmailProvider);
    process.env.SESSION_SECRET = STAGING_SECRET;
    delete process.env.ENABLE_TEST_AUTH_MOCK;
    delete process.env.ENVIRONMENT;

    // Seed exam catalog required for relational integrity
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

    await db.insert(subjects).values({
      id: "subj_bio",
      examId: "exam_neet",
      name: "Biology",
      slug: "biology",
      displayOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(chapters).values({
      id: "chap_cell",
      subjectId: "subj_bio",
      name: "Cell Biology",
      slug: "cell-biology",
      displayOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(topics).values({
      id: "top_cell_cycle",
      chapterId: "chap_cell",
      name: "Cell Cycle",
      slug: "cell-cycle",
      displayOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => {
    setEmailProvider(null);
    process.env = { ...originalEnv };
    globalThis.__CLOUDFLARE_ENV__ = originalCfEnv;
  });

  // ==========================================
  // 1. STAGING DEMO AUTHENTICATION SUCCEEDS
  // ==========================================
  describe("1. Staging demo authentication succeeds", () => {
    it("signs in with the default demo profile in staging", async () => {
      setEnvironment("staging");

      const res = await demoHandler(demoRequest({}));
      expect(res.status).toBe(200);

      const data = (await res.json()) as {
        success: boolean;
        user: { id: string; email: string };
        workspaceId: string | null;
      };
      const identity = STAGING_DEMO_IDENTITIES[0];
      expect(data.success).toBe(true);
      expect(data.user.id).toBe(identity.userId);
      expect(data.user.email).toBe(identity.email);
      expect(data.workspaceId).toBeTruthy();

      // User row exists in D1
      const rows = await db.select().from(users).where(eq(users.id, identity.userId));
      expect(rows).toHaveLength(1);
      expect(rows[0].email).toBe(identity.email);
    });

    it("signs in with a specific roster slot and never accepts other identities", async () => {
      setEnvironment("staging");

      const res = await demoHandler(demoRequest({ slot: "friend-2" }));
      expect(res.status).toBe(200);

      const data = (await res.json()) as { user: { id: string } };
      const identity = STAGING_DEMO_IDENTITIES[1];
      expect(data.user.id).toBe(identity.userId);
    });

    it("is idempotent: repeat sign-ins reuse the same demo user and workspace", async () => {
      setEnvironment("staging");

      const res1 = await demoHandler(demoRequest({ slot: "friend-1" }));
      const data1 = (await res1.json()) as { user: { id: string }; workspaceId: string };
      const res2 = await demoHandler(demoRequest({ slot: "friend-1" }));
      const data2 = (await res2.json()) as { user: { id: string }; workspaceId: string };

      expect(data2.user.id).toBe(data1.user.id);
      expect(data2.workspaceId).toBe(data1.workspaceId);

      const wsRows = await db
        .select()
        .from(userWorkspaces)
        .where(eq(userWorkspaces.userId, data1.user.id));
      expect(wsRows).toHaveLength(1);
    });

    it("session endpoint advertises demo profiles in staging", async () => {
      setEnvironment("staging");

      const res = await sessionHandler(new Request(`${STAGING_URL}/api/auth/session`));
      const data = (await res.json()) as {
        demoAuth: { enabled: boolean; options: { slot: string; label: string }[] };
      };
      expect(data.demoAuth.enabled).toBe(true);
      expect(data.demoAuth.options).toHaveLength(STAGING_DEMO_IDENTITIES.length);
      // Only public-safe fields are exposed
      for (const option of data.demoAuth.options) {
        expect(Object.keys(option).sort()).toEqual(["label", "slot"]);
      }
    });
  });

  // ==========================================
  // 2. STAGING DEMO SESSION IS VALID
  // ==========================================
  describe("2. Staging demo session is valid", () => {
    it("issues the normal signed pv_session that resolves to the demo user", async () => {
      setEnvironment("staging");

      const res = await demoHandler(demoRequest({ slot: "friend-1" }));
      const setCookie = res.headers.get("Set-Cookie") ?? "";
      const token = extractCookie(setCookie, SESSION_COOKIE_NAME);
      expect(token).toBeTruthy();

      // Token is HMAC-signed with SESSION_SECRET and unexpired
      const payload = await verifyToken<SessionTokenPayload>(token ?? "");
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(STAGING_DEMO_IDENTITIES[0].userId);
      expect(payload?.email).toBe(STAGING_DEMO_IDENTITIES[0].email);
      expect(payload!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

      // Session resolves against D1 and returns the demo identity
      const session = await getSession(setCookie, db);
      expect(session).not.toBeNull();
      expect(session?.user.id).toBe(STAGING_DEMO_IDENTITIES[0].userId);
      expect(session?.user.email).toBe(STAGING_DEMO_IDENTITIES[0].email);
    });

    it("rejects a forged session token", async () => {
      setEnvironment("staging");
      await demoHandler(demoRequest({ slot: "friend-1" }));

      const forged = `${btoa(JSON.stringify({ userId: STAGING_DEMO_IDENTITIES[0].userId }))}.forgedsignature`;
      const session = await getSession(`${SESSION_COOKIE_NAME}=${forged}`, db);
      expect(session).toBeNull();
    });
  });

  // ==========================================
  // 3. DEMO USER / WORKSPACE OWNERSHIP
  // ==========================================
  describe("3. Staging demo user/workspace ownership works", () => {
    it("provisions an owned workspace and enforces ownership on /api/workspaces", async () => {
      setEnvironment("staging");

      const res = await demoHandler(demoRequest({ slot: "friend-1" }));
      const data = (await res.json()) as { user: { id: string }; workspaceId: string };

      const wsRows = await db
        .select()
        .from(userWorkspaces)
        .where(eq(userWorkspaces.userId, data.user.id));
      expect(wsRows).toHaveLength(1);
      expect(wsRows[0].id).toBe(data.workspaceId);
      expect(wsRows[0].examAttemptId).toBe("attempt_neet_2027");

      // Authenticated listing strictly scoped to the session user
      const wsRes = await workspacesHandler(
        authedRequest("/api/workspaces", res.headers.get("Set-Cookie") ?? "")
      );
      expect(wsRes.status).toBe(200);
      const wsData = (await wsRes.json()) as {
        workspaces: { id: string; userId: string }[];
      };
      expect(wsData.workspaces).toHaveLength(1);
      expect(wsData.workspaces[0].id).toBe(data.workspaceId);
      expect(wsData.workspaces[0].userId).toBe(data.user.id);
    });

    it("isolates demo identities from each other", async () => {
      setEnvironment("staging");

      const res1 = await demoHandler(demoRequest({ slot: "friend-1" }));
      const data1 = (await res1.json()) as { user: { id: string }; workspaceId: string };
      const res2 = await demoHandler(demoRequest({ slot: "friend-2" }));
      const data2 = (await res2.json()) as { user: { id: string }; workspaceId: string };

      expect(data1.user.id).not.toBe(data2.user.id);
      expect(data1.workspaceId).not.toBe(data2.workspaceId);

      // Friend 2 sees only their own workspace
      const wsRes = await workspacesHandler(
        authedRequest("/api/workspaces", res2.headers.get("Set-Cookie") ?? "")
      );
      const wsData = (await wsRes.json()) as {
        workspaces: { id: string; userId: string }[];
      };
      expect(wsData.workspaces).toHaveLength(1);
      expect(wsData.workspaces[0].userId).toBe(data2.user.id);
      expect(wsData.workspaces.some((w) => w.id === data1.workspaceId)).toBe(false);
    });
  });

  // ==========================================
  // 4. GUEST MIGRATION STILL WORKS
  // ==========================================
  describe("4. Guest migration still works", () => {
    it("migrates guest data into the demo account via the authenticated endpoint", async () => {
      setEnvironment("staging");

      const res = await demoHandler(demoRequest({ slot: "friend-3" }));
      const data = (await res.json()) as { user: { id: string }; workspaceId: string };
      const setCookie = res.headers.get("Set-Cookie") ?? "";

      const validReq = new Request(`${STAGING_URL}/api/auth/migrate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${extractCookie(setCookie, SESSION_COOKIE_NAME)}`,
        },
        body: JSON.stringify({
          guestId: "guest_friend_3",
          workspaces: [
            {
              id: "guest_ws_1",
              examAttemptId: "attempt_neet_2027",
              isActive: true,
            },
          ],
          topicProgress: [
            {
              workspaceId: "guest_ws_1",
              topicId: "top_cell_cycle",
              status: "learning",
              practiceAttempts: 3,
              correctAnswers: 2,
              incorrectAnswers: 1,
              accuracy: 6667,
            },
          ],
          plannerTasks: [
            {
              workspaceId: "guest_ws_1",
              title: "Revise Cell Cycle",
              scheduledDate: "2026-10-05",
            },
          ],
          preferences: { theme: "dark", dailyStudyGoalMinutes: 180 },
        }),
      });

      const okRes = await migrateHandler(validReq);
      expect(okRes.status).toBe(200);
      const okData = (await okRes.json()) as {
        success: boolean;
        summary: {
          workspacesMigrated: number;
          topicProgressMigrated: number;
          plannerTasksMigrated: number;
        };
      };
      expect(okData.success).toBe(true);
      // Guest workspace deduplicates into the existing demo workspace
      expect(okData.summary.workspacesMigrated).toBe(0);
      expect(okData.summary.topicProgressMigrated).toBe(1);
      expect(okData.summary.plannerTasksMigrated).toBe(1);

      // Migrated data belongs to the demo user's workspace
      const progressRows = await db
        .select()
        .from(userTopicProgress)
        .where(eq(userTopicProgress.topicId, "top_cell_cycle"));
      expect(progressRows).toHaveLength(1);
      expect(progressRows[0].workspaceId).toBe(data.workspaceId);

      const taskRows = await db.select().from(plannerTasks);
      expect(taskRows).toHaveLength(1);
      expect(taskRows[0].workspaceId).toBe(data.workspaceId);
    });
  });

  // ==========================================
  // 5. NO TOKEN EXPOSURE
  // ==========================================
  describe("5. Staging demo auth does not expose tokens", () => {
    it("returns no verification/session tokens in the response body", async () => {
      setEnvironment("staging");

      const res = await demoHandler(demoRequest({ slot: "friend-1" }));
      const raw = await res.text();
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      expect(parsed.success).toBe(true);
      expect("token" in parsed).toBe(false);
      expect("_testToken" in parsed).toBe(false);
      expect(parsed.token).toBeUndefined();
      expect(parsed._testToken).toBeUndefined();
      expect(parsed.purpose).toBeUndefined();

      // The signed session token itself never appears in the body
      const cookieToken = extractCookie(res.headers.get("Set-Cookie") ?? "", SESSION_COOKIE_NAME);
      expect(cookieToken).toBeTruthy();
      expect(raw).not.toContain(cookieToken ?? "");
    });

    it("never dispatches email as part of demo authentication", async () => {
      setEnvironment("staging");

      await demoHandler(demoRequest({ slot: "friend-1" }));
      await demoHandler(demoRequest({ slot: "friend-2" }));
      expect(testEmailProvider.sentEmails).toHaveLength(0);
    });
  });

  // ==========================================
  // 6. NO ARBITRARY IDENTITY CLAIMS
  // ==========================================
  describe("6. Staging demo auth does not accept arbitrary user IDs", () => {
    it("rejects client-controlled user/email/workspace/environment claims", async () => {
      setEnvironment("staging");

      const res = await demoHandler(
        demoRequest({
          slot: "friend-1",
          userId: "usr_victim",
          email: "victim@example.com",
          workspaceId: "ws_victim",
          environment: "staging",
        })
      );
      expect(res.status).toBe(400);

      const victimRows = await db.select().from(users).where(eq(users.id, "usr_victim"));
      expect(victimRows).toHaveLength(0);
    });

    it("rejects slots outside the fixed roster", async () => {
      setEnvironment("staging");

      // One valid sign-in so a known roster user exists
      const ok = await demoHandler(demoRequest({ slot: "friend-1" }));
      expect(ok.status).toBe(200);

      for (const bad of ["friend-99", "usr_demo_staging_friend1", "", "admin"]) {
        const res = await demoHandler(demoRequest({ slot: bad }));
        expect(res.status).toBe(400);
      }

      // Only roster identities exist afterwards
      const allUsers = await db.select().from(users);
      const rosterIds = STAGING_DEMO_IDENTITIES.map((i) => i.userId);
      expect(allUsers.length).toBeGreaterThan(0);
      for (const user of allUsers) {
        expect(rosterIds).toContain(user.id);
      }
    });
  });

  // ==========================================
  // 7. PRODUCTION DEMO AUTH IS REJECTED
  // ==========================================
  describe("7. Production demo authentication is rejected", () => {
    it("fails closed with 404 in production, development, and unset environments", async () => {
      for (const env of ["production", "development", "preview", undefined]) {
        setEnvironment(env);
        const res = await demoHandler(demoRequest({ slot: "friend-1" }));
        expect(res.status).toBe(404);
      }

      const allUsers = await db.select().from(users);
      expect(allUsers).toHaveLength(0);
    });

    it("cannot be enabled via client-supplied values or test flags", async () => {
      setEnvironment("production");
      process.env.ENABLE_TEST_AUTH_MOCK = "true";
      globalThis.__CLOUDFLARE_ENV__ = {
        DB: currentD1,
        ENVIRONMENT: "production",
        ENABLE_TEST_AUTH_MOCK: "true",
      } as unknown as CloudflareEnv;

      const spoofed = await demoHandler(demoRequest({ environment: "staging", slot: "friend-1" }));
      expect(spoofed.status).toBe(404);

      // Near-miss environment strings never enable demo auth (strict match,
      // no trimming or normalization)
      for (const env of ["staging2", "staging-prod", "prod", " Staging", "staging "]) {
        setEnvironment(env);
        const res = await demoHandler(demoRequest({}));
        expect(res.status).toBe(404);
      }
    });
  });

  // ==========================================
  // 8. PRODUCTION STILL REQUIRES NORMAL AUTH
  // ==========================================
  describe("8. Production still requires the normal authentication path", () => {
    it("reports demoAuth disabled and keeps protected endpoints locked", async () => {
      setEnvironment("production");

      // Session endpoint: anonymous + demo auth disabled
      const sessionRes = await sessionHandler(
        new Request("https://parikshaverse.in/api/auth/session")
      );
      const sessionData = (await sessionRes.json()) as {
        user: unknown;
        demoAuth: { enabled: boolean; options: unknown[] };
      };
      expect(sessionData.user).toBeNull();
      expect(sessionData.demoAuth.enabled).toBe(false);
      expect(sessionData.demoAuth.options).toHaveLength(0);

      // Migration still demands an authenticated session
      const migrateRes = await migrateHandler(
        new Request("https://parikshaverse.in/api/auth/migrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guestId: "guest_x" }),
        })
      );
      expect(migrateRes.status).toBe(401);

      // Workspace listing still demands an authenticated session
      const wsRes = await workspacesHandler(new Request("https://parikshaverse.in/api/workspaces"));
      expect(wsRes.status).toBe(401);
    });

    it("still supports the normal magic-link verification flow in production", async () => {
      setEnvironment("production");

      // Normal email-based flow remains untouched: a signed magic-link token
      // verifies into a standard session via /api/auth/verify. The token must
      // be recorded server-side first (one-time use) — the same record step
      // the sign-in route performs before delivering the email.
      const { createMagicLinkToken } = await import("@/lib/auth/crypto-session");
      const { recordVerificationTokenIssued } = await import(
        "@/lib/auth/verification-tokens"
      );
      const { POST: verifyHandler } = await import("@/app/api/auth/verify/route");
      const email = "prod.student@example.com";
      const token = await createMagicLinkToken(email);
      await recordVerificationTokenIssued(db, { email, token });

      const res = await verifyHandler(
        new Request("https://parikshaverse.in/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, token }),
        })
      );
      expect(res.status).toBe(200);

      const data = (await res.json()) as { success: boolean; user: { email: string } };
      expect(data.success).toBe(true);
      expect(data.user.email).toBe(email);
      expect(res.headers.get("Set-Cookie")).toContain(SESSION_COOKIE_NAME);
    });
  });

  // ==========================================
  // 9. SESSION COOKIE SECURITY FLAGS
  // ==========================================
  describe("9. Session cookies retain existing security flags", () => {
    it("sets pv_session with HttpOnly, Secure, SameSite=Lax, Path=/ and 30-day expiry", async () => {
      setEnvironment("staging");

      const res = await demoHandler(demoRequest({ slot: "friend-1" }));
      const setCookie = res.headers.get("Set-Cookie") ?? "";

      expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(setCookie).toContain("; HttpOnly");
      expect(setCookie).toContain("; Secure");
      expect(setCookie).toContain("; SameSite=Lax");
      expect(setCookie).toContain("; Path=/");
      expect(setCookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
    });
  });

  // ==========================================
  // 10. CROSS-USER AUTHORIZATION REMAINS INTACT
  // ==========================================
  describe("10. Existing cross-user/mock-test authorization remains intact", () => {
    it("demo session cannot access another user's mock test data", async () => {
      setEnvironment("staging");

      // Regular (non-demo) user Bob with a completed mock test
      await db.insert(users).values({
        id: "usr_student_bob",
        email: "bob@test.in",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(userWorkspaces).values({
        id: "ws_bob",
        userId: "usr_student_bob",
        examAttemptId: "attempt_neet_2027",
        isActive: true,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(mockTests).values({
        id: "mock_bob_test",
        workspaceId: "ws_bob",
        title: "Bob Mock",
        type: "full_syllabus",
        durationMinutes: 180,
        totalQuestions: 180,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const now = new Date();
      await db.insert(mockTestSessions).values({
        id: "sess_bob_1",
        workspaceId: "ws_bob",
        mockTestId: "mock_bob_test",
        status: "completed",
        questionIds: JSON.stringify(["q1", "q2"]),
        selectedAnswers: JSON.stringify({ q1: "opt_a" }),
        markedForReview: JSON.stringify([]),
        currentIndex: 0,
        durationSeconds: 7200,
        startedAt: now,
        expiresAt: new Date(now.getTime() + 7200000),
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(mockTestResults).values({
        id: "res_sess_bob_1",
        mockTestId: "mock_bob_test",
        sessionId: "sess_bob_1",
        score: 650,
        totalMarks: 720,
        correct: 165,
        incorrect: 10,
        unattempted: 5,
        accuracy: 9428,
        timeSpentSeconds: 6500,
        submissionStatus: "completed",
        sectionResults: JSON.stringify([{ sectionName: "Physics", rawScore: 160 }]),
        questionResults: JSON.stringify([{ questionId: "q1", isCorrect: true }]),
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Demo user friend-1 gets their own workspace
      const res = await demoHandler(demoRequest({ slot: "friend-1" }));
      const data = (await res.json()) as { user: { id: string }; workspaceId: string };

      // Demo workspace cannot read Bob's session/result
      const forgedResult = await mockTestRepository.getResultBySessionId(
        db,
        "sess_bob_1",
        data.workspaceId
      );
      expect(forgedResult).toBeNull();

      const forgedSession = await mockTestRepository.getSession(db, "sess_bob_1", data.workspaceId);
      expect(forgedSession).toBeNull();

      // Bob's own result is still readable from Bob's workspace
      const bobResult = await mockTestRepository.getResultBySessionId(db, "sess_bob_1", "ws_bob");
      expect(bobResult).not.toBeNull();

      // Demo session's workspace listing excludes Bob's workspace
      const wsRes = await workspacesHandler(
        authedRequest("/api/workspaces", res.headers.get("Set-Cookie") ?? "")
      );
      const wsData = (await wsRes.json()) as {
        workspaces: { id: string; userId: string }[];
      };
      expect(wsData.workspaces.some((w) => w.id === "ws_bob")).toBe(false);
      expect(wsData.workspaces.every((w) => w.userId === data.user.id)).toBe(true);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestD1Database } from "./db-test-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { DatabaseInstance } from "@/db";
import {
  users,
  userWorkspaces,
  exams,
  examAttempts,
  subjects,
  chapters,
  topics,
  mockTests,
  mockTestSessions,
  mockTestResults,
} from "@/db/schema";
import {
  signToken,
  verifyToken,
  createMagicLinkToken,
  getSessionSecret,
  KNOWN_INSECURE_DEV_SECRET,
  type VerificationTokenPayload,
} from "@/lib/auth/crypto-session";
import {
  createSessionCookie,
  shouldUseSecureCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import {
  TestEmailProvider,
  setEmailProvider,
  sendMagicLinkEmail,
} from "@/lib/email/email-service";
import { mockTestRepository } from "@/repositories/mock-test.repository";
import { guestMigrationPayloadSchema } from "@/lib/auth/guest-migration-schema";
import { executeServerMigration } from "@/lib/auth/guest-migration-server";
import { recordVerificationTokenIssued } from "@/lib/auth/verification-tokens";
import { POST as signInHandler } from "@/app/api/auth/sign-in/route";
import { POST as createAccountHandler } from "@/app/api/auth/create-account/route";
import { POST as verifyHandler } from "@/app/api/auth/verify/route";

describe("Phase 13A.1 — Authentication & Security Remediation", () => {
  let db: DatabaseInstance;
  let testEmailProvider: TestEmailProvider;
  const originalEnv = { ...process.env };
  const originalCfEnv = globalThis.__CLOUDFLARE_ENV__;

  beforeEach(async () => {
    const d1 = createTestD1Database();
    globalThis.__CLOUDFLARE_ENV__ = { DB: d1 };
    db = drizzle(d1, { schema });

    testEmailProvider = new TestEmailProvider();
    setEmailProvider(testEmailProvider);
    process.env.SESSION_SECRET = "test_vitest_mock_session_secret_32b_min_length";
    delete process.env.ENABLE_TEST_AUTH_MOCK;

    // Seed exam & attempt for relational integrity
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
  // AUTH TESTS
  // ==========================================
  describe("AUTH: SEC-01 & SEC-02 & SEC-04", () => {
    it("1. sign-in response does NOT contain token", async () => {
      const email = "student_signin@example.com";
      await db.insert(users).values({
        id: "usr_signin_1",
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new Request("http://localhost:3000/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const res = await signInHandler(req);
      const data = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.token).toBeUndefined();
      expect("token" in data).toBe(false);
      expect(data._testToken).toBeUndefined();
    });

    it("2. create-account response does NOT contain token", async () => {
      const email = "new_student_create@example.com";
      const req = new Request("http://localhost:3000/api/auth/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const res = await createAccountHandler(req);
      const data = (await res.json()) as Record<string, unknown>;

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.token).toBeUndefined();
      expect("token" in data).toBe(false);
      expect(data._testToken).toBeUndefined();
    });

    it("3. verification still works with a valid test adapter/mock", async () => {
      const email = "verify_student@example.com";
      const token = await createMagicLinkToken(email);
      // Phase 14E: tokens are one-time-use, so a token only verifies once its
      // server-side record exists — exactly what the sign-in route does before
      // delivering it.
      await recordVerificationTokenIssued(db, { email, token });

      const req = new Request("http://localhost:3000/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
      });

      const res = await verifyHandler(req);
      const data = (await res.json()) as { success: boolean; user: { email: string } };

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe(email);
      expect(res.headers.get("Set-Cookie")).toContain(SESSION_COOKIE_NAME);
    });

    it("4. invalid verification fails", async () => {
      const req = new Request("http://localhost:3000/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "victim@example.com", token: "invalid.forged.token" }),
      });

      const res = await verifyHandler(req);
      expect(res.status).toBe(401);
      const data = (await res.json()) as { error: string };
      expect(data.error).toContain("Invalid or expired");
    });

    it("5. expired verification fails", async () => {
      const email = "expired@example.com";
      const expiredPayload: VerificationTokenPayload = {
        email,
        purpose: "magic_link",
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) - 1800, // 30 minutes in past
      };
      const expiredToken = await signToken(expiredPayload);

      const verified = await verifyToken(expiredToken);
      expect(verified).toBeNull();

      const req = new Request("http://localhost:3000/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: expiredToken }),
      });

      const res = await verifyHandler(req);
      expect(res.status).toBe(401);
    });

    it("6. missing SESSION_SECRET fails safely", async () => {
      // In staging/production, missing SESSION_SECRET must throw and fail closed
      process.env.ENVIRONMENT = "production";
      delete process.env.SESSION_SECRET;

      expect(() => getSessionSecret()).toThrow("SESSION_SECRET is missing");

      // verifyToken returns null safely
      const verified = await verifyToken("some.token");
      expect(verified).toBeNull();
    });

    it("7. development default SESSION_SECRET is rejected in staging/production mode", () => {
      // In production mode with the known default secret
      process.env.ENVIRONMENT = "production";
      process.env.SESSION_SECRET = KNOWN_INSECURE_DEV_SECRET;

      expect(() => getSessionSecret()).toThrow(
        "SESSION_SECRET cannot be the default development secret in staging or production."
      );

      // In staging mode with the known default secret
      process.env.ENVIRONMENT = "staging";
      expect(() => getSessionSecret()).toThrow(
        "SESSION_SECRET cannot be the default development secret in staging or production."
      );
    });
  });

  // ==========================================
  // SESSION & COOKIE TESTS (SEC-05)
  // ==========================================
  describe("SESSION: SEC-05 Secure Cookie", () => {
    it("8. HTTPS session cookie contains HttpOnly, Secure, SameSite=Lax, Path=/", () => {
      const httpsReq = new Request("https://staging.parikshaverse.in/api/auth/verify");
      const cookieHeader = createSessionCookie("sample_token_xyz", httpsReq);

      expect(cookieHeader).toContain(`${SESSION_COOKIE_NAME}=sample_token_xyz`);
      expect(cookieHeader).toContain("; HttpOnly");
      expect(cookieHeader).toContain("; Secure");
      expect(cookieHeader).toContain("; SameSite=Lax");
      expect(cookieHeader).toContain("; Path=/");

      // Verify shouldUseSecureCookie directly on HTTPS URL string
      expect(shouldUseSecureCookie("https://parikshaverse.in/api/auth/verify")).toBe(true);
      expect(shouldUseSecureCookie("https://staging.parikshaverse.in/api/auth/verify")).toBe(true);
    });

    it("9. localhost HTTP development remains functional without Secure", () => {
      const httpReq = new Request("http://localhost:3000/api/auth/verify");
      const cookieHeader = createSessionCookie("local_token_abc", httpReq);

      expect(cookieHeader).toContain(`${SESSION_COOKIE_NAME}=local_token_abc`);
      expect(cookieHeader).toContain("; HttpOnly");
      expect(cookieHeader).toContain("; SameSite=Lax");
      expect(cookieHeader).toContain("; Path=/");
      // Must NOT contain Secure on local HTTP
      expect(cookieHeader).not.toContain("; Secure");

      // Verify shouldUseSecureCookie directly for localhost
      expect(shouldUseSecureCookie("http://localhost:3000")).toBe(false);
      expect(shouldUseSecureCookie("http://127.0.0.1:3000")).toBe(false);
    });
  });

  // ==========================================
  // AUTHORIZATION / IDOR TESTS (SEC-03)
  // ==========================================
  describe("AUTHORIZATION: SEC-03 Mock Test Result IDOR", () => {
    const userA = "usr_student_alice";
    const userB = "usr_student_bob";
    const wsA = "ws_alice";
    const wsB = "ws_bob";
    const mockIdA = "mock_alice_test";
    const mockIdB = "mock_bob_test";
    const sessionIdA = "sess_alice_123";

    beforeEach(async () => {
      // Users
      await db.insert(users).values([
        { id: userA, email: "alice@test.in", createdAt: new Date(), updatedAt: new Date() },
        { id: userB, email: "bob@test.in", createdAt: new Date(), updatedAt: new Date() },
      ]);

      // Workspaces
      await db.insert(userWorkspaces).values([
        { id: wsA, userId: userA, examAttemptId: "attempt_neet_2027", isActive: true, startedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
        { id: wsB, userId: userB, examAttemptId: "attempt_neet_2027", isActive: true, startedAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      ]);

      // Mock tests
      await db.insert(mockTests).values([
        { id: mockIdA, workspaceId: wsA, title: "Alice Mock", type: "full_syllabus", durationMinutes: 180, totalQuestions: 180, createdAt: new Date(), updatedAt: new Date() },
        { id: mockIdB, workspaceId: wsB, title: "Bob Mock", type: "full_syllabus", durationMinutes: 180, totalQuestions: 180, createdAt: new Date(), updatedAt: new Date() },
      ]);

      // Alice's completed session & result
      const now = new Date();
      await db.insert(mockTestSessions).values({
        id: sessionIdA,
        workspaceId: wsA,
        mockTestId: mockIdA,
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
        id: `res_${sessionIdA}`,
        mockTestId: mockIdA,
        sessionId: sessionIdA,
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
    });

    it("10. User B cannot access User A mock result", async () => {
      // User A can access their own result
      const aliceResult = await mockTestRepository.getResultBySessionId(db, sessionIdA, wsA);
      expect(aliceResult).not.toBeNull();
      expect(aliceResult?.rawScore).toBe(650);

      // User B attempting to query User A's result using their own workspaceId
      const bobResult = await mockTestRepository.getResultBySessionId(db, sessionIdA, wsB);
      expect(bobResult).toBeNull();
    });

    it("11. User B cannot access User A mock session result", async () => {
      // Querying session directly with User B's workspace returns null
      const bobSession = await mockTestRepository.getSession(db, sessionIdA, wsB);
      expect(bobSession).toBeNull();
    });

    it("12. workspace manipulation does not bypass ownership", async () => {
      // Trying arbitrary non-existent or foreign workspaceId returns null
      const forgedResult1 = await mockTestRepository.getResultBySessionId(db, sessionIdA, "ws_evil_hacker");
      expect(forgedResult1).toBeNull();

      const forgedResult2 = await mockTestRepository.getResultBySessionId(db, sessionIdA, "");
      expect(forgedResult2).toBeNull();
    });
  });

  // ==========================================
  // GUEST MIGRATION VALIDATION TESTS (SEC-13)
  // ==========================================
  describe("MIGRATION: SEC-13 Input Validation", () => {
    it("13. valid guest migration still works", async () => {
      const validPayload = {
        guestId: "guest_valid_123",
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
            status: "learned" as const,
            practiceAttempts: 5,
            correctAnswers: 4,
            incorrectAnswers: 1,
            accuracy: 8000,
          },
        ],
      };

      const parseResult = guestMigrationPayloadSchema.safeParse(validPayload);
      expect(parseResult.success).toBe(true);

      if (parseResult.success) {
        // Create user for migration
        await db.insert(users).values({
          id: "usr_migrating_test",
          email: "migrating_test@parikshaverse.in",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        const summary = await executeServerMigration(
          db,
          "usr_migrating_test",
          parseResult.data as unknown as import("@/lib/auth/auth-types").GuestMigrationPayload
        );
        expect(summary.workspacesMigrated).toBe(1);
        expect(summary.topicProgressMigrated).toBe(1);
      }
    });

    it("14. malformed migration payload is rejected", () => {
      // Missing guestId
      const missingGuestId = {
        workspaces: [{ examAttemptId: "attempt_neet_2027" }],
      };
      expect(guestMigrationPayloadSchema.safeParse(missingGuestId).success).toBe(false);

      // Malformed topic progress status
      const invalidStatus = {
        guestId: "guest_bad",
        topicProgress: [
          {
            workspaceId: "ws_1",
            topicId: "top_1",
            status: "hacked_status",
          },
        ],
      };
      expect(guestMigrationPayloadSchema.safeParse(invalidStatus).success).toBe(false);

      // Non-object payload
      expect(guestMigrationPayloadSchema.safeParse("not a json object").success).toBe(false);
      expect(guestMigrationPayloadSchema.safeParse(null).success).toBe(false);
    });

    it("15. oversized/unreasonable payload is rejected where appropriate", () => {
      // Exceeding maximum allowed workspaces
      const tooManyWorkspaces = {
        guestId: "guest_flood",
        workspaces: Array.from({ length: 25 }, (_, i) => ({
          examAttemptId: `attempt_${i}`,
        })),
      };
      expect(guestMigrationPayloadSchema.safeParse(tooManyWorkspaces).success).toBe(false);

      // Negative practice attempts
      const negativeAttempts = {
        guestId: "guest_neg",
        topicProgress: [
          {
            workspaceId: "ws_1",
            topicId: "top_1",
            practiceAttempts: -5,
          },
        ],
      };
      expect(guestMigrationPayloadSchema.safeParse(negativeAttempts).success).toBe(false);
    });
  });

  // ==========================================
  // EMAIL PROVIDER TESTS (SEC-04)
  // ==========================================
  describe("EMAIL: SEC-04 Delivery & Test Isolation", () => {
    it("16. email provider is invoked with the correct recipient and verification link", async () => {
      const email = "aspirant@parikshaverse.in";
      const verificationUrl = "https://parikshaverse.in/auth/verify?token=xyz123&email=aspirant@parikshaverse.in";

      const res = await sendMagicLinkEmail({
        email,
        verificationUrl,
        token: "xyz123",
      });

      expect(res.success).toBe(true);
      expect(testEmailProvider.sentEmails).toHaveLength(1);
      expect(testEmailProvider.sentEmails[0].email).toBe(email);
      expect(testEmailProvider.sentEmails[0].verificationUrl).toBe(verificationUrl);
      expect(testEmailProvider.sentEmails[0].token).toBe("xyz123");
    });

    it("17. provider failure produces a safe error", async () => {
      testEmailProvider.shouldFail = true;
      testEmailProvider.failureMessage = "SMTP relay timed out";

      const email = "failing_delivery@example.com";
      await db.insert(users).values({
        id: "usr_fail_test",
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new Request("http://localhost:3000/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const res = await signInHandler(req);
      expect(res.status).toBe(500);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe("Failed to send verification email. Please try again later.");
    });

    it("18. real token is never returned in API JSON", async () => {
      const email = "student_no_leak@example.com";
      await db.insert(users).values({
        id: "usr_no_leak",
        email,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new Request("http://localhost:3000/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const res = await signInHandler(req);
      const rawText = await res.text();
      const parsed = JSON.parse(rawText);

      expect(parsed.token).toBeUndefined();
      expect(parsed._testToken).toBeUndefined();
      // Ensure the generated token sent to email provider was NOT in the response JSON
      const deliveredToken = testEmailProvider.sentEmails[0]?.token;
      expect(deliveredToken).toBeDefined();
      expect(rawText).not.toContain(deliveredToken);
    });
  });
});

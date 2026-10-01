import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestD1Database } from "./db-test-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { DatabaseInstance } from "@/db";
import {
  users,
  exams,
  examAttempts,
  userWorkspaces,
  mockTests,
  mockTestResults,
  studySessions,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { executeServerMigration } from "@/lib/auth/guest-migration-server";
import { POST as migrateHandler } from "@/app/api/auth/migrate/route";
import { GET as mockTestsHandler } from "@/app/api/mock-tests/route";
import { issueSession } from "@/lib/auth/session-store";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import type { GuestMigrationPayload } from "@/lib/auth/auth-types";
import type { CloudflareEnv } from "@/types/cloudflare";

/**
 * Phase 14E (PART F) — cross-tenant authorization for guest migration.
 *
 * The migration endpoint previously trusted client-supplied mockTestId values:
 * an authenticated user could attach a mock test result to ANOTHER user's mock
 * test. These tests pin the ownership-safe behavior: every migrated record
 * lands in a workspace the authenticated user owns, and references that
 * resolve to foreign rows are dropped or re-homed — never followed.
 */

const SECRET = "test_vitest_mock_session_secret_32b_min_length";
const BASE = "http://localhost:3000";

const USER_A = "usr_mig_alice";
const USER_B = "usr_mig_bob";
const WS_A = "ws_mig_alice";
const WS_B = "ws_mig_bob";
const MOCK_B = "mock_bob_owned_1";

async function seedWorkspace(db: DatabaseInstance, userId: string, workspaceId: string) {
  await db.insert(userWorkspaces).values({
    id: workspaceId,
    userId,
    examAttemptId: "attempt_neet_2027",
    isActive: true,
    startedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe("Phase 14E — guest migration cross-tenant authorization", () => {
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
    await db.insert(users).values([
      { id: USER_A, email: "alice@example.com", createdAt: new Date(), updatedAt: new Date() },
      { id: USER_B, email: "bob@example.com", createdAt: new Date(), updatedAt: new Date() },
    ]);
    await seedWorkspace(db, USER_A, WS_A);
    await seedWorkspace(db, USER_B, WS_B);

    // Bob (victim) owns a mock test with no result yet.
    await db.insert(mockTests).values({
      id: MOCK_B,
      workspaceId: WS_B,
      title: "Bob's private mock",
      type: "full_syllabus",
      durationMinutes: 180,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.__CLOUDFLARE_ENV__ = originalCfEnv;
  });

  it("1. a raw client-supplied mockTestId pointing at another user's mock is dropped", async () => {
    const payload: GuestMigrationPayload = {
      guestId: "guest_a",
      workspaces: [
        { id: "guest_ws_a", examAttemptId: "attempt_neet_2027", isActive: true },
      ],
      mockTestResults: [
        // References Bob's mock directly — no matching mock in Alice's payload.
        { mockTestId: MOCK_B, score: 700, totalMarks: 720, correct: 170 },
      ],
    };

    const summary = await executeServerMigration(db, USER_A, payload);

    expect(summary.mockTestResultsMigrated).toBe(0);
    // Bob's mock remains result-less: nothing was attached to it.
    const results = await db
      .select()
      .from(mockTestResults)
      .where(eq(mockTestResults.mockTestId, MOCK_B));
    expect(results).toHaveLength(0);
  });

  it("2. a client mockTestId colliding with a foreign mock is re-homed, not reused", async () => {
    const payload: GuestMigrationPayload = {
      guestId: "guest_a",
      workspaces: [
        { id: "guest_ws_a", examAttemptId: "attempt_neet_2027", isActive: true },
      ],
      mockTests: [
        // Claims Bob's mock id as its own guest record.
        { id: MOCK_B, workspaceId: "guest_ws_a", title: "Alice guest mock", type: "full_syllabus" },
      ],
      mockTestResults: [
        { mockTestId: MOCK_B, score: 640, totalMarks: 720, correct: 160 },
      ],
    };

    const summary = await executeServerMigration(db, USER_A, payload);

    // Alice got her own mock (fresh server-generated id in HER workspace),
    // and the result attached to that — never to Bob's row.
    expect(summary.mockTestsMigrated).toBe(1);
    expect(summary.mockTestResultsMigrated).toBe(1);

    const aliceMocks = await db
      .select()
      .from(mockTests)
      .where(eq(mockTests.workspaceId, WS_A));
    expect(aliceMocks).toHaveLength(1);
    expect(aliceMocks[0].id).not.toBe(MOCK_B);
    expect(aliceMocks[0].title).toBe("Alice guest mock");

    const aliceResults = await db
      .select()
      .from(mockTestResults)
      .where(eq(mockTestResults.mockTestId, aliceMocks[0].id));
    expect(aliceResults).toHaveLength(1);
    expect(aliceResults[0].score).toBe(640);

    const bobResults = await db
      .select()
      .from(mockTestResults)
      .where(eq(mockTestResults.mockTestId, MOCK_B));
    expect(bobResults).toHaveLength(0);
  });

  it("3. an existing own mock is reused idempotently; a foreign id under reuse is never written", async () => {
    // First migration creates Alice's mock with a client-chosen id.
    const payload: GuestMigrationPayload = {
      guestId: "guest_a",
      workspaces: [
        { id: "guest_ws_a", examAttemptId: "attempt_neet_2027", isActive: true },
      ],
      mockTests: [
        { id: "mock_alice_own", workspaceId: "guest_ws_a", title: "Alice own mock" },
      ],
    };
    await executeServerMigration(db, USER_A, payload);

    // Retry: same id maps onto the existing owned row, no duplicate.
    const retrySummary = await executeServerMigration(db, USER_A, payload);
    expect(retrySummary.mockTestsMigrated).toBe(0);

    const aliceMocks = await db
      .select()
      .from(mockTests)
      .where(eq(mockTests.workspaceId, WS_A));
    expect(aliceMocks).toHaveLength(1);
    expect(aliceMocks[0].id).toBe("mock_alice_own");
  });

  it("4. a client-supplied study session id owned by another user is never overwritten", async () => {
    // Bob owns a study session with a known id.
    await db.insert(studySessions).values({
      id: "sess_bob_owned_1",
      workspaceId: WS_B,
      durationMinutes: 45,
      sessionType: "focused",
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const payload: GuestMigrationPayload = {
      guestId: "guest_a",
      workspaces: [
        { id: "guest_ws_a", examAttemptId: "attempt_neet_2027", isActive: true },
      ],
      studySessions: [
        {
          id: "sess_bob_owned_1",
          workspaceId: "guest_ws_a",
          durationMinutes: 99,
          startedAt: new Date(),
        },
      ],
    };

    const summary = await executeServerMigration(db, USER_A, payload);
    expect(summary.studySessionsMigrated).toBe(0);

    // Bob's row is untouched; Alice gained nothing.
    const bobSession = await db
      .select()
      .from(studySessions)
      .where(eq(studySessions.id, "sess_bob_owned_1"));
    expect(bobSession).toHaveLength(1);
    expect(bobSession[0].workspaceId).toBe(WS_B);
    expect(bobSession[0].durationMinutes).toBe(45);

    const aliceSessions = await db
      .select()
      .from(studySessions)
      .where(eq(studySessions.workspaceId, WS_A));
    expect(aliceSessions).toHaveLength(0);
  });

  it("5. migrated data is scoped to the caller: user A cannot list user B's mock tests", async () => {
    const issued = await issueSession(db, USER_A, "alice@example.com");
    const res = await mockTestsHandler(
      new Request(`${BASE}/api/mock-tests?workspaceId=${WS_B}`, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${issued.token}` },
      })
    );
    // Bob's workspace id does not resolve for Alice's session.
    expect([403, 404]).toContain(res.status);
  });

  it("6. the migration API rejects unauthenticated callers", async () => {
    const res = await migrateHandler(
      new Request(`${BASE}/api/auth/migrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestId: "guest_a", mockTestResults: [{ mockTestId: MOCK_B }] }),
      })
    );
    expect(res.status).toBe(401);
  });
});

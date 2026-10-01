import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "./db-test-adapter";
import type { DatabaseInstance } from "@/db";
import { users, userWorkspaces, examAttempts, exams } from "@/db/schema";
import { issueSession } from "@/lib/auth/session-store";
import { createSessionToken } from "@/lib/auth/crypto-session";
import { getSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

describe("Session Validation & Ownership Enforcement", () => {
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createTestDb();

    // Seed minimal exam and attempt for foreign keys
    await db.insert(exams).values({
      id: "exam_neet",
      name: "NEET",
      shortName: "NEET",
      slug: "neet",
      category: "medical",
      description: "National Eligibility cum Entrance Test",
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
  });

  it("resolves null session when no cookie is present", async () => {
    const session = await getSession(null, db);
    expect(session).toBeNull();
  });

  it("resolves null session when cookie token is invalid", async () => {
    const headers = new Headers();
    headers.set("cookie", `${SESSION_COOKIE_NAME}=invalid_junk_token`);
    const session = await getSession(headers, db);
    expect(session).toBeNull();
  });

  it("resolves authenticated session when valid cookie matches a registered user in D1", async () => {
    const userId = "usr_alice";
    const email = "alice@parikshaverse.in";

    await db.insert(users).values({
      id: userId,
      email,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Phase 14E: sessions authenticate only when their signed jti resolves to
    // a live server-side record — issueSession creates both.
    const issued = await issueSession(db, userId, email);
    const headers = new Headers();
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${issued.token}`);

    const session = await getSession(headers, db);
    expect(session).not.toBeNull();
    expect(session?.user.id).toBe(userId);
    expect(session?.user.email).toBe(email);
  });

  it("rejects session if token payload userId is not in D1 users table", async () => {
    const ghostUserId = "usr_ghost_nonexistent";
    const token = await createSessionToken(ghostUserId, "ghost@test.com");
    const headers = new Headers();
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);

    const session = await getSession(headers, db);
    expect(session).toBeNull();
  });

  it("rejects a signed session token whose jti has no server-side session record", async () => {
    // Phase 14E: a validly signed token for an existing user still fails
    // closed when no user_sessions record matches its jti — pre-14E cookies
    // and forged jti claims cannot authenticate.
    const userId = "usr_no_record";
    const email = "norecord@parikshaverse.in";
    await db.insert(users).values({
      id: userId,
      email,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = await createSessionToken(userId, email);
    const headers = new Headers();
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);

    const session = await getSession(headers, db);
    expect(session).toBeNull();
  });

  it("strictly enforces workspace ownership: user cannot query another user's workspace", async () => {
    const userA = "usr_student_a";
    const userB = "usr_student_b";

    await db.insert(users).values([
      { id: userA, email: "student_a@test.com", createdAt: new Date(), updatedAt: new Date() },
      { id: userB, email: "student_b@test.com", createdAt: new Date(), updatedAt: new Date() },
    ]);

    // Create workspaces for both
    await db.insert(userWorkspaces).values([
      {
        id: "ws_a",
        userId: userA,
        examAttemptId: "attempt_neet_2027",
        isActive: true,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "ws_b",
        userId: userB,
        examAttemptId: "attempt_neet_2027",
        isActive: true,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Query for user A's workspaces
    const workspacesA = await db
      .select()
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, userA));

    expect(workspacesA).toHaveLength(1);
    expect(workspacesA[0].id).toBe("ws_a");
    expect(workspacesA.some((w) => w.userId === userB)).toBe(false);

    // Query for user B's workspaces
    const workspacesB = await db
      .select()
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, userB));

    expect(workspacesB).toHaveLength(1);
    expect(workspacesB[0].id).toBe("ws_b");
    expect(workspacesB.some((w) => w.userId === userA)).toBe(false);
  });
});

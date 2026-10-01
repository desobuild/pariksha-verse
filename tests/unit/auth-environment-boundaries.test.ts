import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestD1Database } from "./db-test-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { DatabaseInstance } from "@/db";
import { users, exams, examAttempts } from "@/db/schema";
import { extractCookie, SESSION_COOKIE_NAME, getSession } from "@/lib/auth/session";
import { TestEmailProvider, setEmailProvider } from "@/lib/email/email-service";
import { POST as signInHandler } from "@/app/api/auth/sign-in/route";
import { POST as verifyHandler } from "@/app/api/auth/verify/route";
import { POST as demoHandler } from "@/app/api/auth/demo/route";
import { GET as sessionHandler } from "@/app/api/auth/session/route";
import type { CloudflareEnv } from "@/types/cloudflare";

/**
 * Phase 14B (PART D) — Auth environment boundaries.
 *
 * One explicit matrix pinning the product's authentication scope:
 * - LOCAL:    magic-link/test auth works (Console/Test provider, sanctioned
 *             _testToken escape hatch on the local dev server only).
 * - STAGING:  demo Friend 1–5 sign-in works and is decided server-side.
 * - ELSEWHERE: demo auth fails closed (404), and no public email signup
 *             machinery is exposed beyond the pre-existing magic-link APIs.
 */

const LOCAL_SECRET = "test_vitest_mock_session_secret_32b_min_length";
const BASE = "http://localhost:3000";

describe("Phase 14B — Auth environment boundaries", () => {
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

  function jsonRequest(path: string, body: unknown, method = "POST"): Request {
    return new Request(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  beforeEach(async () => {
    currentD1 = createTestD1Database();
    // Default: local development shape — a D1 binding, NO ENVIRONMENT.
    globalThis.__CLOUDFLARE_ENV__ = { DB: currentD1 } as unknown as CloudflareEnv;
    db = drizzle(currentD1, { schema });

    testEmailProvider = new TestEmailProvider();
    setEmailProvider(testEmailProvider);
    process.env.SESSION_SECRET = LOCAL_SECRET;
    delete process.env.ENABLE_TEST_AUTH_MOCK;
    delete process.env.ENVIRONMENT;

    // Exam catalog for demo workspace provisioning; a real local user for
    // the magic-link flow.
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
      id: "usr_local_student",
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

  describe("STAGING: demo Friend 1-5 sign-in", () => {
    it("signs a demo profile in when ENVIRONMENT is exactly staging", async () => {
      setEnvironment("staging");

      const res = await demoHandler(jsonRequest("/api/auth/demo", { slot: "friend-2" }));
      expect(res.status).toBe(200);

      // Read the body once; assert success and that no token appears in it.
      const raw = await res.text();
      const body = JSON.parse(raw) as {
        success?: boolean;
        user?: { id: string };
        workspaceId?: string | null;
      };
      expect(body.success).toBe(true);
      expect(body.user?.id).toBe("usr_demo_staging_friend2");
      expect(body.workspaceId).not.toBeNull();
      expect(raw).not.toContain("token");
      const cookie = res.headers.get("Set-Cookie") ?? "";
      expect(extractCookie(cookie, SESSION_COOKIE_NAME)).toBeTruthy();

      const session = await getSession(
        new Request(`${BASE}/api/auth/session`, {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${extractCookie(cookie, SESSION_COOKIE_NAME)}` },
        })
      );
      expect(session?.user.id).toBe("usr_demo_staging_friend2");
    });

    it("keeps GET /api/auth/session advertising demo only in staging", async () => {
      setEnvironment("staging");
      const stagingRes = await sessionHandler(new Request(`${BASE}/api/auth/session`));
      const stagingBody = (await stagingRes.json()) as {
        demoAuth: { enabled: boolean; options: { slot: string; label: string }[] };
      };
      expect(stagingBody.demoAuth.enabled).toBe(true);
      expect(stagingBody.demoAuth.options).toHaveLength(5);
      // Public-safe shape: slot + label only, never ids or emails.
      for (const option of stagingBody.demoAuth.options) {
        expect(Object.keys(option).sort()).toEqual(["label", "slot"]);
      }

      setEnvironment(undefined);
      const localRes = await sessionHandler(new Request(`${BASE}/api/auth/session`));
      const localBody = (await localRes.json()) as typeof stagingBody;
      expect(localBody.demoAuth.enabled).toBe(false);
      expect(localBody.demoAuth.options).toEqual([]);
    });
  });

  describe("NOT STAGING: demo auth fails closed", () => {
    const nonStagingEnvironments: Array<[string, string | undefined]> = [
      ["production", "production"],
      ["development", "development"],
      ["unset", undefined],
    ];

    for (const [label, env] of nonStagingEnvironments) {
      it(`returns 404 when ENVIRONMENT is ${label}`, async () => {
        setEnvironment(env);
        const res = await demoHandler(jsonRequest("/api/auth/demo", { slot: "friend-1" }));
        expect(res.status).toBe(404);
      });
    }

    it("cannot be enabled through the local test-auth flag", async () => {
      setEnvironment("production", { ENABLE_TEST_AUTH_MOCK: "true" });
      process.env.ENABLE_TEST_AUTH_MOCK = "true";

      const res = await demoHandler(jsonRequest("/api/auth/demo", { slot: "friend-1" }));
      expect(res.status).toBe(404);
    });

    it("rejects client-controlled identity claims regardless of environment", async () => {
      setEnvironment("staging");
      const res = await demoHandler(
        jsonRequest("/api/auth/demo", {
          slot: "friend-1",
          email: "attacker@example.com",
          userId: "usr_victim",
          workspaceId: "ws_victim",
        })
      );
      // Strict schema: any smuggled claim is a 400, never an identity source.
      expect([400, 404]).toContain(res.status);
      if (res.status === 400) {
        const body = (await res.json()) as { error?: string };
        expect(body.error).toBeTruthy();
      }
    });
  });

  describe("LOCAL: magic-link test auth remains functional", () => {
    it("completes the full magic-link flow through the same verify API the /auth/verify page uses", async () => {
      process.env.ENABLE_TEST_AUTH_MOCK = "true";

      const signInRes = await signInHandler(
        jsonRequest("/api/auth/sign-in", { email: "student@example.com" })
      );
      expect(signInRes.status).toBe(200);
      const signInBody = (await signInRes.json()) as { _testToken?: string; success?: boolean };
      expect(signInBody.success).toBe(true);
      expect(typeof signInBody._testToken).toBe("string");

      const token = signInBody._testToken as string;
      const verifyRes = await verifyHandler(
        jsonRequest("/api/auth/verify", { email: "student@example.com", token })
      );
      expect(verifyRes.status).toBe(200);

      const rawVerify = await verifyRes.text();
      expect(rawVerify).not.toContain(token);
      const cookie = verifyRes.headers.get("Set-Cookie") ?? "";
      const sessionToken = extractCookie(cookie, SESSION_COOKIE_NAME);
      expect(sessionToken).toBeTruthy();

      const session = await getSession(
        new Request(`${BASE}/api/auth/session`, {
          headers: { cookie: `${SESSION_COOKIE_NAME}=${sessionToken}` },
        })
      );
      expect(session?.user.email).toBe("student@example.com");
    });

    it("does not leak a test token when the flag is off", async () => {
      const res = await signInHandler(
        jsonRequest("/api/auth/sign-in", { email: "student@example.com" })
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { _testToken?: string };
      expect(body._testToken).toBeUndefined();
    });

    it("never leaks a test token in staging even with the flag set", async () => {
      setEnvironment("staging");
      process.env.ENABLE_TEST_AUTH_MOCK = "true";
      // Drop the test provider override: staging resolves its provider from
      // configuration alone, which is deliberately unconfigured.
      setEmailProvider(null);

      const res = await signInHandler(
        jsonRequest("/api/auth/sign-in", { email: "student@example.com" })
      );
      // Staging has no email provider configured by design: sign-in fails
      // safely and never returns a verification token.
      expect(res.status).toBe(500);
      const body = (await res.json()) as { _testToken?: string; error?: string };
      expect(body._testToken).toBeUndefined();
    });
  });
});

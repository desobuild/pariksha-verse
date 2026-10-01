import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as healthHandler } from "@/app/api/health/route";
import { GET as readyHandler } from "@/app/api/health/ready/route";
import { getSession } from "@/lib/auth/session";
import { createSessionToken } from "@/lib/auth/crypto-session";
import { createTestD1Database } from "./db-test-adapter";
import { APP_COMMIT_SHA, APP_VERSION } from "@/lib/observability/version";

/**
 * Phase 14G — health/readiness endpoints and the D1 failure signals around
 * auth session resolution.
 *
 * Security expectations are as important as the functional ones: the public
 * bodies stay minimal, and a failing readiness probe must not reveal WHICH
 * component failed (that detail belongs to server-side logs only).
 */

const ORIGINAL_CF_ENV = (globalThis as { __CLOUDFLARE_ENV__?: unknown }).__CLOUDFLARE_ENV__;
const ORIGINAL_ENV = { ...process.env };

function setCfEnv(value: unknown): void {
  (globalThis as { __CLOUDFLARE_ENV__?: unknown }).__CLOUDFLARE_ENV__ = value;
}

function failingD1(): D1Database {
  return {
    prepare: () => {
      throw new Error("D1_ERROR: simulated outage (no such table: simulated_failure)");
    },
  } as unknown as D1Database;
}

describe("Phase 14G — GET /api/health (liveness)", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setCfEnv(ORIGINAL_CF_ENV);
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns 200 with the minimal diagnostic payload", async () => {
    setCfEnv({ DB: createTestD1Database(), ENVIRONMENT: "staging" });
    const response = await healthHandler();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.status).toBe("healthy"); // Phase 14F contract
    expect(body.service).toBe("pariksha-verse");
    expect(body.environment).toBe("staging");
    expect(body.version).toBe(APP_VERSION);
    expect(body.deployment).toBe(APP_COMMIT_SHA);
  });

  it("exposes no secrets, bindings, database details, or internals", async () => {
    setCfEnv({
      DB: createTestD1Database(),
      ENVIRONMENT: "production",
      SESSION_SECRET: "super-secret-value-that-must-not-appear",
    });
    const response = await healthHandler();
    const body = (await response.json()) as Record<string, unknown>;
    const raw = JSON.stringify(body);

    expect(raw).not.toContain("super-secret-value-that-must-not-appear");
    expect(raw.toLowerCase()).not.toContain("session_secret");
    expect(raw).not.toContain("d1Configured");
    expect(raw).not.toContain("prepare");
    // No database object / binding leakage of any kind.
    expect(body.database).toBeUndefined();
    expect(Object.keys(body).sort()).toEqual([
      "deployment",
      "environment",
      "ok",
      "service",
      "status",
      "version",
    ]);
  });

  it("performs no database query (liveness must stay cheap)", async () => {
    // A binding whose every call throws: the liveness probe never touches it,
    // so this still returns 200.
    setCfEnv({ DB: failingD1(), ENVIRONMENT: "staging" });
    const response = await healthHandler();
    expect(response.status).toBe(200);
  });
});

describe("Phase 14G — GET /api/health/ready (readiness)", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setCfEnv(ORIGINAL_CF_ENV);
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns 200 when the database and configuration are available", async () => {
    setCfEnv({ DB: createTestD1Database(), ENVIRONMENT: "staging" });
    process.env.SESSION_SECRET = "test_vitest_mock_session_secret_32b_min_length";

    const response = await readyHandler(
      new Request("https://staging.example.com/api/health/ready")
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("pariksha-verse");
    expect(body.environment).toBe("staging");
  });

  it("returns generic 503 (ok:false) on D1 failure and logs the detail server-side", async () => {
    setCfEnv({ DB: failingD1(), ENVIRONMENT: "staging" });
    process.env.SESSION_SECRET = "test_vitest_mock_session_secret_32b_min_length";

    const response = await readyHandler(
      new Request("https://staging.example.com/api/health/ready", {
        headers: { "x-request-id": "req-ready-1" },
      })
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    // Public response stays generic: no component names, no error text.
    expect(body).toEqual({ ok: false });

    // Server-side log carries the diagnostic detail, tagged with the request id.
    const lines = errorSpy.mock.calls.map((call) => String(call[0]));
    const entry = JSON.parse(lines.find((l) => l.includes("health.ready.failed")) ?? "{}") as {
      component?: string;
      request_id?: string;
      error_message?: string;
    };
    expect(entry.component).toBe("database");
    expect(entry.request_id).toBe("req-ready-1");
    expect(entry.error_message).toContain("simulated outage");
  });

  it("returns generic 503 when auth configuration is missing in a strict environment", async () => {
    setCfEnv({ DB: createTestD1Database(), ENVIRONMENT: "staging" });
    delete process.env.SESSION_SECRET;

    const response = await readyHandler(
      new Request("https://staging.example.com/api/health/ready")
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
  });

  it("never reveals which component failed in the response body", async () => {
    setCfEnv({ DB: failingD1(), ENVIRONMENT: "production" });
    delete process.env.SESSION_SECRET;

    const response = await readyHandler(new Request("https://example.com/api/health/ready"));
    const raw = await response.text();

    expect(response.status).toBe(503);
    expect(raw).not.toContain("database");
    expect(raw).not.toContain("configuration");
    expect(raw).not.toContain("D1_ERROR");
    expect(raw).not.toContain("SESSION_SECRET");
  });
});

describe("Phase 14G — auth session D1 failure signal", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setCfEnv(ORIGINAL_CF_ENV);
    process.env = { ...ORIGINAL_ENV };
  });

  it("getSession still fails closed on D1 failure but emits db.query.failure without user data", async () => {
    process.env.SESSION_SECRET = "test_vitest_mock_session_secret_32b_min_length";
    setCfEnv({ DB: failingD1(), ENVIRONMENT: "staging" });

    const email = "session-failure-user@example.com";
    const token = await createSessionToken("usr_test_user", email);

    const session = await getSession(`pv_session=${encodeURIComponent(token)}`);

    // Semantics unchanged: D1 failure is fail-closed (null), not a crash.
    expect(session).toBeNull();

    // The failure is observable — and the log line carries no email/token.
    const lines = errorSpy.mock.calls.map((call) => String(call[0]));
    const entry = JSON.parse(lines.find((l) => l.includes("db.query.failure")) ?? "{}") as Record<
      string,
      unknown
    >;
    expect(entry.event).toBe("db.query.failure");
    expect(entry.scope).toBe("auth.session");

    const allOutput = lines.join("\n");
    expect(allOutput).not.toContain(email);
    expect(allOutput).not.toContain(token);
  });
});

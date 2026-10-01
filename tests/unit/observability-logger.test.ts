import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logEvent, logger, resolveEnvironment, sanitizeFields } from "@/lib/observability/logger";
import { APP_COMMIT_SHA, APP_VERSION } from "@/lib/observability/version";
import * as packageJson from "../../package.json";

/**
 * Phase 14G — structured logger contract.
 *
 * The privacy/security contract is the critical part: sensitive keys must be
 * redacted before anything is serialized, non-primitive values must never be
 * dumped, and every entry must carry the core identification fields.
 */

type LogSpy = ReturnType<typeof vi.spyOn>;

function captureConsole(method: "info" | "warn" | "error"): { spy: LogSpy; lines: () => string[] } {
  const spy = vi.spyOn(console, method).mockImplementation(() => {});
  return { spy, lines: () => spy.mock.calls.map((call) => String(call[0])) };
}

describe("Phase 14G — structured logger", () => {
  let spies: LogSpy[] = [];

  beforeEach(() => {
    spies = [];
  });

  afterEach(() => {
    spies.forEach((spy) => spy.mockRestore());
    vi.restoreAllMocks();
  });

  function spyAll(): void {
    spies.push(
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {})
    );
  }

  function allLines(): string[] {
    return spies.flatMap((spy) => spy.mock.calls.map((call) => String(call[0])));
  }

  function parseLines(): Array<Record<string, unknown>> {
    return allLines().map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  describe("entry shape", () => {
    it("emits one JSON line with the core fields on console.info", () => {
      spyAll();
      logger.info("health.check");

      const entries = parseLines();
      expect(entries).toHaveLength(1);
      const entry = entries[0];
      expect(entry.level).toBe("info");
      expect(entry.service).toBe("pariksha-verse");
      expect(entry.event).toBe("health.check");
      expect(typeof entry.timestamp).toBe("string");
      expect(isNaN(Date.parse(String(entry.timestamp)))).toBe(false);
      expect(entry.version).toBe(APP_VERSION);
      expect(entry.deployment).toBe(APP_COMMIT_SHA);
      expect(typeof entry.environment).toBe("string");
    });

    it("routes levels to the matching console method", () => {
      const info = captureConsole("info");
      const warn = captureConsole("warn");
      const error = captureConsole("error");
      spies.push(info.spy, warn.spy, error.spy);

      logger.info("a.info");
      logger.warn("a.warn");
      logger.error("a.error");

      expect(info.lines()).toHaveLength(1);
      expect(JSON.parse(info.lines()[0]).event).toBe("a.info");
      expect(warn.lines()).toHaveLength(1);
      expect(JSON.parse(warn.lines()[0]).event).toBe("a.warn");
      expect(error.lines()).toHaveLength(1);
      expect(JSON.parse(error.lines()[0]).event).toBe("a.error");
    });

    it("normalizes illegal characters in event names", () => {
      spyAll();
      logger.info("auth.login success\ninjected");
      expect(parseLines()[0].event).toBe("auth.login_success_injected");
    });
  });

  describe("sensitive-field redaction", () => {
    it("redacts credential-shaped keys before serialization", () => {
      spyAll();
      logger.warn("test.redaction", {
        token: "super-secret-token-value",
        tokenHash: "deadbeef",
        session: "ses_123",
        sessionId: "ses_456",
        cookie: "pv_session=steal-me",
        authorization: "Bearer abc",
        email: "user@example.com",
        password: "hunter2",
        secret: "SESSION_SECRET_VALUE",
        apiKey: "rk_live_123",
        api_key: "rk_live_456",
      });

      const entry = parseLines()[0];
      const sensitiveKeys = [
        "token",
        "tokenHash",
        "session",
        "sessionId",
        "cookie",
        "authorization",
        "email",
        "password",
        "secret",
        "apiKey",
        "api_key",
      ];
      for (const key of sensitiveKeys) {
        expect(entry[key], `field "${key}" must be redacted`).toBe("[redacted]");
      }
      // The raw secret values must not appear anywhere in the emitted line.
      const raw = allLines()[0];
      expect(raw).not.toContain("super-secret-token-value");
      expect(raw).not.toContain("user@example.com");
      expect(raw).not.toContain("SESSION_SECRET_VALUE");
      expect(raw).not.toContain("hunter2");
      expect(raw).not.toContain("pv_session=steal-me");
    });

    it("keeps safe primitive fields untouched", () => {
      spyAll();
      logger.info("rate_limit.blocked", {
        rule: "auth_sign_in_ip",
        limiter: "d1_fixed_window",
        request_id: "req-123",
        limit: 10,
        allowed: false,
      });

      const entry = parseLines()[0];
      expect(entry.rule).toBe("auth_sign_in_ip");
      expect(entry.limiter).toBe("d1_fixed_window");
      expect(entry.request_id).toBe("req-123");
      expect(entry.limit).toBe(10);
      expect(entry.allowed).toBe(false);
    });

    it("drops undefined fields (typed API) and never serializes objects", () => {
      spyAll();
      logger.info("test.fields", { request_id: "req-1", retry_after_seconds: undefined });

      const entry = parseLines()[0];
      expect(entry.request_id).toBe("req-1");
      expect(entry).not.toHaveProperty("retry_after_seconds");
    });

    it("replaces non-primitive values with a placeholder (runtime guard)", () => {
      const sanitized = sanitizeFields({
        row: { id: 1, email: "user@example.com" },
      } as never);
      expect(sanitized.row).toBe("[non-primitive]");
    });

    it("caps long string values", () => {
      const sanitized = sanitizeFields({ error_message: "x".repeat(1000) });
      expect(String(sanitized.error_message).length).toBeLessThanOrEqual(300);
      expect(String(sanitized.error_message)).toContain("[truncated]");
    });

    it("caps the number of emitted fields", () => {
      const fields: Record<string, string> = {};
      for (let i = 0; i < 40; i += 1) fields[`field_${i}`] = String(i);
      const sanitized = sanitizeFields(fields);
      expect(Object.keys(sanitized).length).toBeLessThanOrEqual(24);
    });
  });

  describe("environment resolution", () => {
    it("prefers the Cloudflare ENVIRONMENT binding", () => {
      const original = globalThis.__CLOUDFLARE_ENV__;
      try {
        (globalThis as { __CLOUDFLARE_ENV__: unknown }).__CLOUDFLARE_ENV__ = {
          ENVIRONMENT: "staging",
        };
        expect(resolveEnvironment()).toBe("staging");
      } finally {
        (globalThis as { __CLOUDFLARE_ENV__: unknown }).__CLOUDFLARE_ENV__ = original;
      }
    });

    it("falls back to process env and NODE_ENV", () => {
      const original = globalThis.__CLOUDFLARE_ENV__;
      try {
        delete (globalThis as { __CLOUDFLARE_ENV__?: unknown }).__CLOUDFLARE_ENV__;
        const originalEnv = process.env.ENVIRONMENT;
        delete process.env.ENVIRONMENT;
        expect(resolveEnvironment()).toBe(process.env.NODE_ENV || "development");
        if (originalEnv !== undefined) process.env.ENVIRONMENT = originalEnv;
      } finally {
        (globalThis as { __CLOUDFLARE_ENV__?: unknown }).__CLOUDFLARE_ENV__ = original;
      }
    });
  });

  describe("logEvent resilience", () => {
    it("never throws, even when the console itself throws", () => {
      const spy = vi.spyOn(console, "info").mockImplementation(() => {
        throw new Error("console is broken");
      });
      spies.push(spy);
      expect(() => logEvent("info", "test.throwing_console")).not.toThrow();
    });
  });
});

describe("Phase 14G — build metadata", () => {
  it("APP_VERSION matches package.json (no separately maintained version)", () => {
    expect(APP_VERSION).toBe(packageJson.version);
  });

  it("APP_COMMIT_SHA is a git SHA or the explicit 'unknown' fallback", () => {
    expect(APP_COMMIT_SHA).toMatch(/^[0-9a-f]{40}$|^unknown$/);
  });
});

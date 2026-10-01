import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiErrorResponse, logErrorWithStack } from "@/lib/observability/api-error";
import { getRequestId, resolveRequestId } from "@/lib/observability/request-id";

/**
 * Phase 14G — request IDs and the centralized API error boundary.
 */

describe("Phase 14G — request ids", () => {
  it("reuses Cloudflare's edge-attested cf-ray when present", () => {
    const request = new Request("https://example.com/api/health", {
      headers: { "cf-ray": "8f5a9c2d1e3b4a67-SIN" },
    });
    expect(resolveRequestId(request)).toBe("8f5a9c2d1e3b4a67-SIN");
  });

  it("ignores malformed cf-ray values and generates a UUID instead", () => {
    const request = new Request("https://example.com/api/health", {
      headers: { "cf-ray": "not-a-ray-id" },
    });
    const id = resolveRequestId(request);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("generates a fresh UUID when no cf-ray exists (local dev)", () => {
    const request = new Request("https://example.com/api/health");
    const first = resolveRequestId(request);
    const second = resolveRequestId(request);
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).toMatch(/^[0-9a-f-]{36}$/);
    expect(first).not.toBe(second);
  });

  it("never honors a client-supplied x-request-id at the resolution boundary", () => {
    const request = new Request("https://example.com/api/health", {
      headers: { "x-request-id": "attacker-chosen-id" },
    });
    const id = resolveRequestId(request);
    expect(id).not.toBe("attacker-chosen-id");
  });

  it("reads the middleware-forwarded id via getRequestId", () => {
    const request = new Request("https://example.com/api/health", {
      headers: { "x-request-id": "8f5a9c2d1e3b4a67-SIN" },
    });
    expect(getRequestId(request)).toBe("8f5a9c2d1e3b4a67-SIN");
  });

  it("returns undefined without a forwarded id", () => {
    expect(getRequestId(new Request("https://example.com/"))).toBeUndefined();
  });
});

describe("Phase 14G — apiErrorResponse", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  function loggedEntries(): Array<Record<string, unknown>> {
    return errorSpy.mock.calls.map(
      (call) => JSON.parse(String(call[0])) as Record<string, unknown>
    );
  }

  it("returns the generic public message and never error details", async () => {
    const request = new Request("https://example.com/api/progress", {
      headers: { "x-request-id": "req-abc" },
    });
    const response = apiErrorResponse({
      event: "api.progress.failure",
      error: new Error("D1_ERROR: no such table: user_progress [bindings: secret-value]"),
      request,
      message: "Failed to load progress",
    });

    expect(response.status).toBe(500);
    // Body must be exactly the generic message — no error name, message,
    // stack, SQL, or bindings.
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ error: "Failed to load progress" });
    expect(body).not.toContain("D1_ERROR");
    expect(body).not.toContain("secret-value");
  });

  it("logs a structured event with the request id and safe error metadata", async () => {
    const request = new Request("https://example.com/api/progress", {
      headers: { "x-request-id": "req-abc" },
    });
    const response = apiErrorResponse({
      event: "api.progress.failure",
      error: new Error("D1_ERROR: no such table: user_progress"),
      request,
      message: "Failed to load progress",
    });
    await response.text();

    const entries = loggedEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].event).toBe("api.progress.failure");
    expect(entries[0].level).toBe("error");
    expect(entries[0].request_id).toBe("req-abc");
    expect(entries[0].error_name).toBe("Error");
    expect(entries[0].error_message).toContain("no such table");
    expect(String(entries[0].error_stack)).toContain("Error:");
  });

  it("omits the stack at warn level (client-caused failures)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = apiErrorResponse({
      event: "test.warn_failure",
      error: new Error("boom"),
      message: "Failed",
      level: "warn",
    });
    await response.text();

    const entries = warnSpy.mock.calls.map(
      (call) => JSON.parse(String(call[0])) as Record<string, unknown>
    );
    warnSpy.mockRestore();
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("warn");
    expect(entries[0]).not.toHaveProperty("error_stack");
  });

  it("redacts sensitive extra fields and handles non-Error throwables", async () => {
    const response = apiErrorResponse({
      event: "test.redacted_failure",
      error: "plain string failure",
      message: "Failed",
      fields: { scope: "auth.session", token: "should-not-appear" },
    });
    await response.text();

    const entries = loggedEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].error_name).toBe("UnknownError");
    expect(entries[0].scope).toBe("auth.session");
    expect(entries[0].token).toBe("[redacted]");
    expect(JSON.stringify(entries)).not.toContain("should-not-appear");
  });

  it("defaults to status 500 and allows overrides", async () => {
    const r1 = apiErrorResponse({ event: "t.a", error: new Error("x"), message: "Nope" });
    await r1.text();
    const r2 = apiErrorResponse({
      event: "t.b",
      error: new Error("x"),
      message: "Nope",
      status: 503,
    });
    await r2.text();
    expect(r1.status).toBe(500);
    expect(r2.status).toBe(503);
  });
});

describe("Phase 14G — logErrorWithStack", () => {
  it("logs the failure for code paths that build their own response", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      logErrorWithStack("db.query.failure", new Error("sqlite io error"), {
        scope: "auth.session",
      });
      expect(spy).toHaveBeenCalledTimes(1);
      const entry = JSON.parse(String(spy.mock.calls[0][0])) as Record<string, unknown>;
      expect(entry.event).toBe("db.query.failure");
      expect(entry.error_message).toBe("sqlite io error");
      expect(entry.scope).toBe("auth.session");
    } finally {
      spy.mockRestore();
    }
  });
});

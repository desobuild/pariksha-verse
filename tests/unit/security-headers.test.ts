import { describe, it, expect } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  createCspNonce,
  shouldSendHsts,
  HSTS_HEADER_VALUE,
  SECURITY_HEADER_VALUES,
} from "@/lib/security/headers";
import { createSessionCookie, createClearSessionCookie } from "@/lib/auth/session";
import { middleware } from "@/middleware";

/**
 * Phase 14F (PART J) — security-header unit/integration tests.
 *
 * These assert the actual headers carried by real Response objects: the pure
 * builder output, the Response the middleware constructs (exactly what the
 * framework serves after merging), and the forwarded CSP request header the
 * framework uses to stamp scripts with the nonce. Live-server behavior is
 * additionally asserted end-to-end in tests/e2e/security-headers.spec.ts
 * (local) and tests/e2e/staging/security-headers.spec.ts (staging).
 */

function cspDirectives(policy: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const directive of policy.split(";")) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    map.set(name, sources.join(" "));
  }
  return map;
}

function middlewareResponse(url: string, init?: { forwardedProto?: string }) {
  const headers = new Headers();
  if (init?.forwardedProto) headers.set("x-forwarded-proto", init.forwardedProto);
  const request = new Request(url, { headers }) as never as Parameters<typeof middleware>[0];
  return middleware(request);
}

describe("Phase 14F — CSP builder", () => {
  it("generates a base64 nonce with sufficient entropy", () => {
    const nonce = createCspNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createCspNonce()).not.toBe(nonce);
  });

  it("allows only same-origin plus a nonce under strict-dynamic for scripts", () => {
    const directives = cspDirectives(buildContentSecurityPolicy("abc123"));
    const scriptSrc = directives.get("script-src")!;
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
  });

  it("never contains wildcard or scheme-wide script sources", () => {
    for (const dev of [true, false]) {
      const scriptSrc = cspDirectives(
        buildContentSecurityPolicy(createCspNonce(), { allowEval: dev })
      ).get("script-src")!;
      expect(scriptSrc).not.toContain("*");
      expect(scriptSrc).not.toContain("http:");
      expect(scriptSrc).not.toContain("https:");
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    }
  });

  it("'unsafe-eval' is a development-only relaxation", () => {
    expect(buildContentSecurityPolicy("n1", { allowEval: true })).toContain(
      "'unsafe-eval'"
    );
    expect(buildContentSecurityPolicy("n1", { allowEval: false })).not.toContain(
      "'unsafe-eval'"
    );
  });

  it("keeps style/img/font/connect/manifest same-origin and allows inline style attributes", () => {
    const directives = cspDirectives(buildContentSecurityPolicy("n"));
    expect(directives.get("default-src")).toBe("'self'");
    expect(directives.get("style-src")).toBe("'self' 'unsafe-inline'");
    expect(directives.get("img-src")).toBe("'self' data:");
    expect(directives.get("font-src")).toBe("'self'");
    expect(directives.get("connect-src")).toBe("'self'");
    expect(directives.get("manifest-src")).toBe("'self'");
  });

  it("locks down base-uri, form-action, frame-ancestors and object-src", () => {
    const directives = cspDirectives(buildContentSecurityPolicy("n"));
    expect(directives.get("base-uri")).toBe("'self'");
    expect(directives.get("form-action")).toBe("'self'");
    expect(directives.get("frame-ancestors")).toBe("'none'");
    expect(directives.get("object-src")).toBe("'none'");
  });
});

describe("Phase 14F — HSTS policy", () => {
  it("is the conservative rollout value: short max-age, includeSubDomains, no preload", () => {
    expect(HSTS_HEADER_VALUE).toBe("max-age=300; includeSubDomains");
    expect(HSTS_HEADER_VALUE.toLowerCase()).not.toContain("preload");
  });

  it("is not sent to localhost HTTP development", () => {
    expect(shouldSendHsts("http://localhost:3000/")).toBe(false);
    expect(shouldSendHsts("http://127.0.0.1:8787/api/health")).toBe(false);
  });

  it("is sent on HTTPS staging/production responses", () => {
    expect(
      shouldSendHsts("https://pariksha-verse-staging.example.workers.dev/")
    ).toBe(true);
    expect(shouldSendHsts("https://parikshaverse.in/")).toBe(true);
    expect(
      shouldSendHsts("http://staging.parikshaverse.in/", "https")
    ).toBe(true);
  });
});

describe("Phase 14F — fixed security headers", () => {
  it("applies nosniff, DENY framing, referrer and permissions policies", () => {
    expect(SECURITY_HEADER_VALUES["x-content-type-options"]).toBe("nosniff");
    expect(SECURITY_HEADER_VALUES["x-frame-options"]).toBe("DENY");
    expect(SECURITY_HEADER_VALUES["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(SECURITY_HEADER_VALUES["cross-origin-opener-policy"]).toBe(
      "same-origin"
    );

    const permissions = SECURITY_HEADER_VALUES["permissions-policy"];
    for (const feature of [
      "accelerometer",
      "camera",
      "geolocation",
      "gyroscope",
      "magnetometer",
      "microphone",
      "payment",
      "usb",
    ]) {
      expect(permissions).toContain(`${feature}=()`);
    }
  });

  it("does not introduce a permissive CORS posture", () => {
    const headers = buildSecurityHeaders({
      nonce: "n",
      requestUrl: "https://parikshaverse.in/",
      isDevelopment: false,
    });
    for (const name of Object.keys(headers)) {
      expect(name.toLowerCase()).not.toContain("access-control-allow");
    }
    expect(headers["content-security-policy"]).not.toContain("*");
  });
});

describe("Phase 14F — middleware response boundary", () => {
  function withNodeEnv<T>(value: string, run: () => T): T {
    const original = process.env.NODE_ENV;
    (process.env as { NODE_ENV: string }).NODE_ENV = value;
    try {
      return run();
    } finally {
      (process.env as { NODE_ENV: string }).NODE_ENV = original as string;
    }
  }

  it("attaches every security header to the actual response", () => {
    const response = withNodeEnv("production", () =>
      middlewareResponse("https://staging.parikshaverse.in/auth/sign-in")
    );
    const csp = response.headers.get("content-security-policy")!;
    expect(csp).toContain("'nonce-");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'"); // production build posture
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    expect(response.headers.get("strict-transport-security")).toBe(
      HSTS_HEADER_VALUE
    );
  });

  it("omits HSTS for localhost HTTP and includes 'unsafe-eval' only in development", () => {
    const response = middlewareResponse("http://localhost:3000/");
    expect(response.headers.get("strict-transport-security")).toBeNull();
    expect(response.headers.get("content-security-policy")).toContain(
      "'unsafe-eval'"
    );
  });

  it("forwards the CSP request header so framework scripts receive the nonce", () => {
    const response = middlewareResponse("https://parikshaverse.in/");
    // Next.js and vinext both propagate middleware request-header overrides on
    // x-middleware-request-* headers (see vinext utils/middleware-request-headers.js).
    const forwarded = response.headers.get(
      "x-middleware-request-content-security-policy"
    );
    expect(forwarded).toContain("'nonce-");
    expect(response.headers.get("x-middleware-override-headers")).toContain(
      "content-security-policy"
    );
  });

  it("issues a fresh nonce per response", () => {
    const first = middlewareResponse("https://parikshaverse.in/").headers.get(
      "content-security-policy"
    )!;
    const second = middlewareResponse("https://parikshaverse.in/").headers.get(
      "content-security-policy"
    )!;
    expect(first).not.toBe(second);
  });
});

describe("Phase 14F — auth cookie hardening regression (PART E)", () => {
  const HTTPS_REQUEST = new Request("https://staging.parikshaverse.in/api/auth/verify");
  const LOCAL_REQUEST = new Request("http://localhost:3000/api/auth/verify");

  it("session cookie stays HttpOnly, SameSite=Lax, Path=/ with a 30-day lifetime", () => {
    const cookie = createSessionCookie("token-value", HTTPS_REQUEST);
    expect(cookie).toContain("pv_session=token-value");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
  });

  it("session cookie is Secure on HTTPS and not Secure on localhost HTTP", () => {
    expect(createSessionCookie("t", HTTPS_REQUEST)).toContain("Secure");
    expect(createSessionCookie("t", LOCAL_REQUEST)).not.toContain("Secure");
  });

  it("logout clears the cookie without loosening its flags", () => {
    const cookie = createClearSessionCookie(HTTPS_REQUEST);
    expect(cookie).toContain("pv_session=;");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
  });

  it("security headers do not strip cookies or Location from forwarded requests", () => {
    const request = new Request("https://parikshaverse.in/api/auth/session", {
      headers: { cookie: "pv_session=abc" },
    }) as never as Parameters<typeof middleware>[0];
    const response = middleware(request);
    const forwardedCookie = response.headers.get("x-middleware-request-cookie");
    expect(forwardedCookie).toBe("pv_session=abc");
  });
});

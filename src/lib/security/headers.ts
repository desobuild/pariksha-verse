/**
 * Phase 14F: browser-facing security headers.
 *
 * This module is the single source of truth for every security response header
 * the application emits. It is a pure builder — no runtime imports — so the
 * values can be unit-tested directly (tests/unit/security-headers.test.ts) and
 * consumed by the one place that applies them: `src/middleware.ts`, which runs
 * for every request in all three runtimes (next dev, next start, vinext on
 * Cloudflare Workers).
 *
 * Runtime findings that shaped this policy (Phase 14F audit):
 * - The app is fully same-origin: every script chunk, stylesheet, font
 *   (self-hosted Inter via next/font), image, the PWA manifest and every fetch
 *   destination live on the deploying origin. No analytics, CDN, Web Worker,
 *   blob:, or service-worker usage exists in the client bundle.
 * - All pages render dynamically (nothing is statically prerendered), so a
 *   per-request CSP nonce can be injected into framework scripts. Vinext
 *   extracts the nonce from the CSP request header
 *   (dist/server/csp.js -> getScriptNonceFromHeaders) and bypasses its shared
 *   response cache whenever a nonce is present, so a cached document can never
 *   pair a stale nonce with a fresh policy header.
 */

/**
 * Content-Security-Policy for ParikshaVerse.
 *
 * Per-directive rationale:
 * - default-src 'self'          — everything the app loads is same-origin;
 *                                 this is the fallback for directives that are
 *                                 deliberately not spelled out (media-src,
 *                                 child-src, worker-src, …).
 * - script-src 'self' 'nonce-…' 'strict-dynamic'
 *                               — framework bootstrap/flight scripts are
 *                                 inline and carry the per-request nonce; route
 *                                 chunks are same-origin files loaded by
 *                                 nonce-trusted scripts, which 'strict-dynamic'
 *                                 permits. No wildcard or host allowlist beyond
 *                                 'self' (ignored by strict-dynamic browsers,
 *                                 kept as a legacy fallback).
 * - style-src 'self' 'unsafe-inline'
 *                               — React and Radix set inline style attributes
 *                                 for positioning/progress bars; 'unsafe-inline'
 *                                 is the only way to keep them working. All
 *                                 stylesheets are same-origin files.
 * - img-src 'self' data:        — images are same-origin (/icon.svg via
 *                                 next/image); data: stays permitted for
 *                                 framework-embedded raster placeholders.
 * - font-src 'self'             — Inter is self-hosted (/_next/static), never
 *                                 fetched from fonts.googleapis.com.
 * - connect-src 'self'          — the client talks only to this origin's API
 *                                 routes and RSC endpoints.
 * - manifest-src 'self'         — the PWA manifest is generated on-origin.
 * - form-action 'self'          — auth forms post to same-origin API routes.
 * - base-uri 'self'             — blocks <base> injection rebasing relative
 *                                 URLs.
 * - frame-ancestors 'none'      — clickjacking: the app is never legitimately
 *                                 framed (matches X-Frame-Options: DENY).
 * - object-src 'none'           — no plugin content; blocks Flash/Java
 *                                 embeds.
 *
 * Deliberately absent:
 * - upgrade-insecure-requests — would upgrade localhost HTTP subresources in
 *   local development and is unnecessary on HTTPS-only deployments.
 * - report-uri/report-to — no external report collector (Phase 14O forbids
 *   introducing external services); violations are asserted via E2E instead.
 */
export function buildContentSecurityPolicy(
  nonce: string,
  { allowEval }: { allowEval?: boolean } = {}
): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (allowEval) scriptSrc.push("'unsafe-eval'");
  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

/**
 * HSTS is intentionally conservative (Phase 14C):
 * - max-age=300 is a safe initial rollout value; raise it once production has
 *   been live on HTTPS long enough to commit.
 * - includeSubDomains is safe today: every operated host (apex, www, staging)
 *   is or will be HTTPS-only, and on staging's workers.dev host the directive
 *   only affects subdomains of that host.
 * - No `preload`: that is an irreversible commitment requiring verification.
 */
export const HSTS_HEADER_VALUE = "max-age=300; includeSubDomains";

/**
 * Modern clickjacking control. Matches X-Frame-Options: DENY so the two
 * policies cannot contradict each other (Phase 14N).
 */
export const FRAME_ANCESTORS = "frame-ancestors 'none'";

/** Fixed-value security headers applied to every worker-served response. */
export const SECURITY_HEADER_VALUES: Readonly<Record<string, string>> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), " +
    "magnetometer=(), microphone=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
};

export interface SecurityHeadersInput {
  /** Per-request CSP nonce (base64). */
  nonce: string;
  /**
   * Absolute request URL as observed by the server (platform-provided; used
   * only to decide whether the connection is HTTPS on a non-local host so
   * HSTS is never served to localhost HTTP development).
   */
  requestUrl: string;
  /** x-forwarded-proto, when the platform provides one. */
  forwardedProto?: string | null;
  /** True when running under next dev / vinext dev (enables 'unsafe-eval'). */
  isDevelopment: boolean;
}

function isHttpsRequest(url: URL, forwardedProto: string | null | undefined): boolean {
  if (url.protocol === "https:") return true;
  return forwardedProto === "https";
}

function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

/**
 * Decides whether Strict-Transport-Security should accompany this response.
 * HSTS is only meaningful (and only safe to advertise) on non-local HTTPS
 * responses; plain-HTTP localhost development must never receive it because
 * browsers persist the policy per-host, which would break repeated local HTTP
 * development on port-swapped hosts.
 */
export function shouldSendHsts(
  requestUrl: string,
  forwardedProto?: string | null
): boolean {
  try {
    const url = new URL(requestUrl);
    if (isLocalHost(url.hostname) && !isHttpsRequest(url, forwardedProto)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds the complete security-header map for a response. Values only —
 * the caller (middleware) owns applying them to the Response and to the
 * forwarded request headers used for CSP nonce propagation.
 */
export function buildSecurityHeaders(input: SecurityHeadersInput): Record<string, string> {
  const headers: Record<string, string> = {
    "content-security-policy": buildContentSecurityPolicy(input.nonce, {
      allowEval: input.isDevelopment,
    }),
    ...SECURITY_HEADER_VALUES,
  };
  if (shouldSendHsts(input.requestUrl, input.forwardedProto)) {
    headers["strict-transport-security"] = HSTS_HEADER_VALUE;
  }
  return headers;
}

/**
 * Generates a fresh base64 CSP nonce. Available in every server runtime this
 * app targets (Node 18+, workerd).
 */
export function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

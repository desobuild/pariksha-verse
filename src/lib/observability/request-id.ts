/**
 * Phase 14G — request / correlation identifiers.
 *
 * The security middleware (src/middleware.ts) resolves one identifier per
 * request that enters server-side handling:
 *
 * 1. `cf-ray` when present — Cloudflare's edge-attested request id. The edge
 *    overwrites it on proxied traffic, so a client cannot choose the value;
 *    reusing it also makes our log lines directly correlatable with
 *    Cloudflare's own request logs for the same request.
 * 2. Otherwise a random UUID (local dev, tests, direct Workers traffic
 *    without the header).
 *
 * Client-supplied `x-request-id` values are deliberately NOT honored — a
 * request-controlled id would let anyone inject attacker-chosen strings into
 * log lines. The resolved id is forwarded to route handlers on the
 * `x-request-id` request header (same propagation pattern as the CSP nonce)
 * and set on the response as `X-Request-ID` so support conversations can name
 * a request without any personal data being involved.
 */

/** cf-ray is hex + "-" + 3-letter POP code; bounded and character-checked. */
const CF_RAY_PATTERN = /^[0-9a-fA-F]{4,32}-[0-9a-zA-Z]{3}$/;

export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Resolves the request id for an incoming request at the middleware boundary:
 * the edge-attested cf-ray when available, else a fresh UUID. Never reads
 * client-supplied identifiers.
 */
export function resolveRequestId(request: Request): string {
  const ray = request.headers.get("cf-ray");
  if (ray && CF_RAY_PATTERN.test(ray)) return ray;
  return crypto.randomUUID();
}

/**
 * Reads the request id the middleware forwarded for this request. Returns
 * undefined outside middleware-handled traffic (unit tests, direct handler
 * invocation), which callers treat as "no request id available".
 */
export function getRequestId(request: Request): string | undefined {
  const value = request.headers.get(REQUEST_ID_HEADER);
  return value && value.length <= 128 ? value : undefined;
}

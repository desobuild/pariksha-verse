import { NextResponse, type NextRequest } from "next/server";
import { buildSecurityHeaders, createCspNonce } from "@/lib/security/headers";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/lib/observability/request-id";

/**
 * Phase 14F: centralized security-response boundary.
 *
 * Every response produced by the app — HTML documents, RSC payloads, API route
 * handlers, redirects, not-founds and other errors — flows through this
 * middleware in every runtime (next dev, next start, and the vinext Worker on
 * Cloudflare). Middleware response headers win over any later header writes
 * (vinext merges them with `set()` semantics; next.config headers skip keys a
 * middleware already set), so applying the policy here is authoritative
 * without duplicating it across routes.
 *
 * Static build assets (`/_next/static/*`) intentionally bypass middleware in
 * all runtimes: they are immutable content-hashed files, never documents, and
 * the deployed Worker serves them from Cloudflare's asset layer before the
 * worker runs. They receive X-Content-Type-Options via `public/_headers`
 * instead; CSP/HSTS/frame controls are meaningless on them.
 *
 * CSP nonce handling: the nonce travels to the framework on a CSP request
 * header (the documented Next.js pattern, also implemented by vinext — see
 * vinext dist/server/csp.js), so framework inline bootstrap scripts are
 * stamped with the same nonce this response's policy allows. Vinext renders
 * responses uncached when a nonce is present, keeping body and policy header
 * from the same request.
 *
 * Phase 14G request/correlation IDs: every middleware-handled request gets a
 * non-PII identifier — the edge-attested `cf-ray` when Cloudflare provides
 * it, else a random UUID (client-supplied values are never honored). It is
 * forwarded to route handlers on the `x-request-id` request header (the same
 * propagation pattern as the CSP nonce) so structured logs and generic error
 * responses can carry it, and set on the response as `X-Request-ID`.
 */
export function middleware(request: NextRequest) {
  const nonce = createCspNonce();
  const requestId = resolveRequestId(request);
  const headers = buildSecurityHeaders({
    nonce,
    requestUrl: request.url,
    forwardedProto: request.headers.get("x-forwarded-proto"),
    // Trusted server-side build mode: 'development' only under next dev /
    // vinext dev; all built artifacts (next start, deployed Worker) run with
    // NODE_ENV=production and never receive 'unsafe-eval'.
    isDevelopment: process.env.NODE_ENV !== "production",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("content-security-policy", headers["content-security-policy"]);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  response.headers.set("X-Request-ID", requestId);
  return response;
}

/**
 * Same default exclusions as the Next.js security-headers documentation, minus
 * `/api` — API responses must carry the security policy too (Phase 14F, Part F).
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

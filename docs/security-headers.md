# ParikshaVerse — Browser Security Headers (Phase 14F)

This document records where the HTTP/browser-facing security policy is
implemented, the exact values shipped, and the compatibility decisions behind
every non-default choice. The implementation deliberately avoids a generic
OWASP header template: every directive below was checked against the actual
application (bundle audit, response-path audit, browser verification).

---

## 1. Where headers are implemented

| Layer | File | Covers |
| --- | --- | --- |
| Central response boundary | `src/middleware.ts` | Every Worker-served response in all runtimes: HTML documents, RSC payloads, API route handlers, app redirects, 404s and other errors |
| Policy values (pure, unit-tested) | `src/lib/security/headers.ts` | Single source of truth for every header value |
| Static build assets | `public/_headers` | `/_next/static/*` and other files served by Cloudflare's asset layer, which never invokes the Worker |
| CSP nonce consumer | `src/app/layout.tsx` | Extracts the per-request nonce from the CSP request header and passes it to next-themes' inline bootstrap script |

Why middleware: it is the only single point that exists in **both** runtimes
(`next dev`/`next start` and the vinext Worker deployed on Cloudflare), and
both frameworks merge middleware response headers into the final response with
`set()` semantics — the middleware policy is authoritative without duplicating
headers across individual routes. `next.config.ts headers()` was rejected as
the primary boundary because vinext does not apply it to every response shape
(framework-generated 404s and plain errors skip it); middleware covers those.

Static build assets intentionally bypass middleware everywhere (Next's default
matcher and Cloudflare's asset layer both short-circuit them). They are
content-hashed, immutable, never documents, and receive `X-Content-Type-Options:
nosniff` plus the immutable cache rule via `public/_headers`. CSP/HSTS/frame
controls are meaningless on non-documents and are deliberately not applied.

---

## 2. Content-Security-Policy

```
default-src 'self';
script-src 'self' 'nonce-<per-request>' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
manifest-src 'self';
form-action 'self';
frame-ancestors 'none';
object-src 'none';
base-uri 'self'
```

Development only (`next dev` / `vinext dev`, detected from the trusted
server-side `NODE_ENV` at build time): `script-src` additionally carries
`'unsafe-eval'` for react-refresh/HMR. Built artifacts never include it.

Per-directive rationale:

- **default-src 'self'** — the Phase 14F bundle audit found a fully
  same-origin app: every script chunk, stylesheet, font (self-hosted Inter via
  next/font — nothing from fonts.googleapis.com), image (`/icon.svg`), the PWA
  manifest and every `fetch()` destination are same-origin. No analytics, no
  CDN assets, no Web Workers, no `blob:` usage, no service worker.
- **script-src 'self' 'nonce-…' 'strict-dynamic'** — framework bootstrap and
  flight-data scripts are inline and stamped with the nonce that middleware
  generates per request. Next.js and vinext both read the nonce from a CSP
  request header (the documented Next.js middleware pattern), and vinext
  renders responses uncached whenever a nonce is present, so a cached document
  can never pair a stale nonce with a fresh policy. Route chunks are
  same-origin files loaded by nonce-trusted scripts, which `'strict-dynamic'`
  permits. There are no wildcard (`*`) or scheme-wide (`https:`) script
  sources; `'self'` is kept as a legacy-browser fallback (ignored by
  strict-dynamic browsers).
- **style-src 'self' 'unsafe-inline'** — required, not lazy: React and Radix
  set inline `style=""` attributes for positioning/progress rendering, and
  CSP treats style attributes as inline. All stylesheets are same-origin
  files.
- **img-src 'self' data:** — images are same-origin; `data:` stays permitted
  for framework-embedded raster placeholders (next/image data-URI handling).
- **font-src 'self'** — Inter ships from `/_next/static/…`.
- **connect-src 'self'** — the client talks only to this origin (API routes,
  RSC payloads, prefetches). Covers dev HMR websockets too (browsers match
  `ws(s)://same-host` under `'self'`).
- **manifest-src 'self'** — the PWA manifest is generated on-origin.
- **form-action 'self'** — auth forms post to same-origin APIs.
- **frame-ancestors 'none'** — the app is never legitimately framed
  (clickjacking control; matches `X-Frame-Options: DENY` so the two policies
  cannot contradict each other).
- **object-src 'none'** — no plugin content.
- **base-uri 'self'** — blocks `<base>` injection rebasing relative URLs.

Deliberately absent:

- `upgrade-insecure-requests` — would upgrade localhost HTTP subresources in
  local development and adds nothing on HTTPS-only deployments.
- `report-uri` / `report-to` — no external report collector (no external
  security services may be introduced); violations are asserted by E2E specs
  instead (`tests/e2e/security-headers.spec.ts` fails on any browser CSP
  violation message).
- `frame-src` / `worker-src` / `media-src` / `child-src` — nothing in the app
  uses them; they fall back to `default-src 'self'`.

The single non-framework inline script in the app is next-themes' theme
flash-prevention bootstrap. `src/app/layout.tsx` reads the nonce from the CSP
request header and passes it to `<ThemeProvider nonce=…>` (supported by
next-themes ≥ 0.4); browser verification confirmed zero violations.

---

## 3. Strict-Transport-Security

```
Strict-Transport-Security: max-age=300; includeSubDomains
```

- Sent **only** on non-local responses. Localhost HTTP (next dev on
  `:3000`, `wrangler dev` on `:8787`) never receives it — browsers persist
  HSTS per host, and a persisted policy would break repeated local HTTP
  development.
- `max-age=300` is the safe initial rollout value; raise it deliberately once
  production has been live on HTTPS long enough to commit.
- `includeSubDomains` is safe: every operated host (apex, `www`, staging) is
  or will be HTTPS-only; on the staging `*.workers.dev` host the directive
  only affects subdomains of that host.
- **No `preload`** — that is an effectively irreversible commitment requiring
  domain verification that has not been done.
- The decision derives from the server-observed request URL and
  `x-forwarded-proto`, never from client-readable configuration.

---

## 4. Other fixed headers

| Header | Value | Note |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | On worker responses and on static assets (`public/_headers`) |
| `X-Frame-Options` | `DENY` | Legacy complement to `frame-ancestors 'none'`; identical policy, no contradiction |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Privacy-preserving default: cross-origin requests leak only the origin; the app keeps full URLs for its own navigation |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()` | The app uses none of these capabilities; nothing is broken |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates the app from any window it might open; safe because the app opens no popups (no OAuth popups exist) |

Not applied, deliberately:

- `Cross-Origin-Embedder-Policy` — would require CORP/CORS headers on every
  subresource including asset-layer files; no cross-origin isolation feature
  needs it. (COOP alone still cuts window-reference leaks.)
- `Cross-Origin-Resource-Policy` on static assets — all consumers are
  same-origin documents; adds deploy risk for no threat-model gain.
- `X-Powered-By` — already suppressed via `next.config.ts` (`poweredByHeader:
  false`).

---

## 5. CORS posture

Default browser same-origin policy, unchanged. An audit of every route in
`src/app/api/**` found zero `Access-Control-*` headers and zero `OPTIONS`
handlers; none were added. No endpoint requires cross-origin access (the only
client is the same-origin PWA), and credentialed cookie endpoints
(`pv_session`) must not be broadened. `Access-Control-Allow-Origin: *` is
specifically absent — asserted by tests.

---

## 6. Authentication cookie interaction (unchanged from Phase 14E)

The middleware adds only security headers; it never touches `Set-Cookie`,
`Location`, or forwarded cookies. Verified flags (asserted by unit and E2E
tests):

- `pv_session`: `HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`
  (30 days), `Secure` whenever the request is HTTPS or forwarded-proto HTTPS
  (staging/production), never `Secure` on localhost HTTP.
- Logout sets `pv_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970
  00:00:00 GMT; HttpOnly; SameSite=Lax` (+ `Secure` on HTTPS) and revokes the
  server-side session record.
- The nonce CSP request header propagates through auth redirects; the magic
  link (`/auth/verify?token=…`) continues to work (E2E-verified locally).

---

## 7. Known framework-level limitation

The bare `308` trailing-slash redirect generated by the framework (Next.js and
vinext alike) is produced **before** middleware and therefore carries no
headers. It has no body and no content a browser will render, so there is no
attack surface; every response that actually renders (the redirect target)
carries the full policy. This is asserted in
`tests/e2e/security-headers.spec.ts`.

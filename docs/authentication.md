# ParikshaVerse — Authentication Architecture (Phase 3)

This document formalizes the authentication mechanism, session lifecycle, security model, and Cloudflare compatibility decisions for ParikshaVerse.

---

## 1. Selected Authentication Mechanism

ParikshaVerse uses an **Edge-Native Passwordless / Magic-Link Authentication** architecture backed by Cloudflare D1 with cryptographically signed, HttpOnly session cookies using the standard **Web Crypto API (`crypto.subtle`)**.

```
Client (Browser / PWA)
   │
   │  POST /api/auth/sign-in { email }
   ▼
Edge Worker / Next.js Route Handler
   ├── 1. Validates email with Zod
   ├── 2. Queries D1 `users` table for account existence
   └── 3. Issues short-lived HMAC-SHA256 verification token (15m TTL)
           │
           ▼
Client verifies token via POST /api/auth/verify { email, token }
   ├── 1. Validates token signature & expiration via Web Crypto
   ├── 2. Creates/updates user record in D1 `users`
   ├── 3. Issues 30-day HMAC-SHA256 session token
   └── 4. Sets `pv_session` HttpOnly, Secure, SameSite=Lax cookie
```

---

## 2. Why This Mechanism Was Selected

1. **100% Cloudflare Workers & Edge Native**:
   - Built on standard `globalThis.crypto.subtle`.
   - Zero Node-only runtime dependencies (`node:crypto`, `bcrypt`, native C++ binaries).
   - Operates within Cloudflare Workers V8 isolates without polyfills.

2. **Decoupled from External Vendor Lock-ins (ADR 1)**:
   - Supabase, Clerk, Firebase, and Auth0 add third-party network hops (50-200ms) on auth verification and external service dependencies.
   - Self-contained edge session verification executes sub-millisecond on Cloudflare's global edge network.

3. **Privacy First (Product Principle)**:
   - **Zero passwords stored**: Eliminates database credential leakage, salt/hash obsolescence, and brute-force attack vectors.
   - **Minimal profile footprint**: Strictly stores `id`, `email`, `createdAt`, `updatedAt` in the existing Phase 2 `users` table. No phone numbers, dates of birth, genders, addresses, or school names are collected.

4. **Seamless Guest Migration**:
   - Session establishment seamlessly coordinates client-side IndexedDB progress migration without disrupting user state.

---

## 3. Session Model & Cookie Strategy

### Session Token Structure
The session token is a compact, URL-safe string:
```
base64url(payloadJson) . base64url(hmacSha256Signature)
```
- **Payload**:
  ```typescript
  export interface SessionTokenPayload {
    userId: string;
    email: string;
    exp: number; // Unix timestamp in seconds (30 days from issuance)
    iat: number;
  }
  ```

### Cookie Attributes
The session cookie (`pv_session`) is set via HTTP response headers:
- `HttpOnly`: Prevents client-side JavaScript (XSS attacks) from reading the auth token.
- `SameSite=Lax`: Mitigates Cross-Site Request Forgery (CSRF) on cross-origin requests.
- `Secure`: Enforced in production to ensure tokens are only transmitted over TLS/HTTPS.
- `Path=/`: Scoped to the entire application origin.
- `Max-Age=2592000`: 30-day session lifetime.

### Sign Out & Invalidation
Sign out calls `/api/auth/sign-out`, which clears the `pv_session` cookie immediately via `Max-Age=0` and `Expires=Thu, 01 Jan 1970 00:00:00 GMT`.

---

## 4. Security Considerations

| Vector | Mitigation |
| :--- | :--- |
| **XSS Token Theft** | Session tokens reside strictly in `HttpOnly` cookies; JavaScript cannot access them. |
| **CSRF** | `SameSite=Lax` cookies prevent malicious third-party origins from sending ambient credentials on unauthorized state-changing cross-site requests. |
| **Token Tampering** | Constant-time HMAC-SHA256 signature verification ensures any bit modification to payload or signature invalidates the token. |
| **ID Spoofing** | Server-side endpoints strictly derive `userId` from the verified cryptographic session. Client-supplied `userId` values in request bodies are explicitly ignored. |
| **Credential Stuffing** | No passwords are stored; brute-force password spraying attacks are inherently impossible. |
| **Sensitive Logging** | Auth tokens and verification secrets are strictly filtered out of application and access logs. |

---

## 5. Alternatives Considered

1. **Auth.js / NextAuth v5**:
   - *Rejected*: Ongoing instability and packaging quirks with Cloudflare Workers / Vite / vinext bundling; bloated bundle size; brittle edge polyfills.
2. **Lucia Auth**:
   - *Rejected*: Deprecated in 2024 by its author, who recommended native Web Crypto session implementations.
3. **Clerk / Supabase Auth**:
   - *Rejected*: Introduces external vendor lock-in, mandatory third-party accounts, latency overhead, and violates ADR 1.
4. **Custom Password Hashing (Argon2 / Scrypt)**:
   - *Rejected*: Requires heavy native binaries or WASM polyfills; introduces password recovery complexity; conflicts with privacy-first minimalist student experience.

---

## 6. Known Limitations & Production Enhancements

- **Email Delivery Adapter**: In local development, test, and preview environments, verification tokens are returned in the response payload for test automation. For production, a transactional email provider (e.g., Cloudflare Workers fetch to Resend, Mailchannels, or SendGrid) can be plugged in without changing domain code.
- **Token Revocation List**: Tokens are stateless for performance. In future enterprise/multi-device management phases, a revocation timestamp column or D1 blocklist can be queried if instantaneous revocation across all devices before 30-day expiry is required.

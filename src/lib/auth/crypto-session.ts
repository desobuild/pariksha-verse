/**
 * Edge-native Web Crypto HMAC-SHA256 Session and Token Utility.
 * 100% compatible with Cloudflare Workers, Edge Runtime, Next.js, and Node.js.
 * Zero external dependencies, zero Node-only crypto modules.
 */

export interface SessionTokenPayload {
  /**
   * Server-side session record id (`user_sessions.id`). Phase 14E: sessions
   * carry a jti so they can be revoked server-side (logout kills a stolen
   * cookie). getSession() fails closed when the signed jti has no live,
   * unrevoked record.
   */
  jti: string;
  userId: string;
  email: string;
  exp: number; // Unix timestamp in seconds
  iat: number;
}

export interface VerificationTokenPayload {
  /**
   * Unique token instance id. Phase 14E: guarantees two tokens issued for the
   * same email within the same second (identical iat/exp) are still distinct
   * strings, so each delivered link is independently one-time-use. Optional in
   * the type only because consumption is by digest — tokens without it are
   * still verifiable once recorded.
   */
  jti?: string;
  email: string;
  purpose: "magic_link" | "verify_email";
  exp: number; // Unix timestamp in seconds
  iat: number;
}

import { getCloudflareEnv } from "@/lib/cloudflare/env";

export const KNOWN_INSECURE_DEV_SECRET =
  "pariksha_verse_dev_secret_key_change_in_production_32b";

/**
 * Resolves the SESSION_SECRET from Cloudflare bindings or process.env.
 * Ensures the hardcoded fallback secret is rejected in staging/production,
 * and fails safely if missing in staging/production.
 */
export function getSessionSecret(customSecret?: string): string {
  if (customSecret && customSecret.trim().length > 0) {
    return customSecret;
  }

  const isServerOrTest =
    typeof window === "undefined" ||
    !!process.env.VITEST ||
    process.env.NODE_ENV === "test";
  const cfEnv = isServerOrTest ? getCloudflareEnv() : {};
  const secret =
    cfEnv.SESSION_SECRET ||
    (typeof process !== "undefined" ? process.env?.SESSION_SECRET : undefined);

  const env = (
    cfEnv.ENVIRONMENT ||
    (typeof process !== "undefined" ? process.env?.ENVIRONMENT || process.env?.NODE_ENV : undefined) ||
    "development"
  ).toLowerCase();

  const isStagingOrProduction =
    env === "production" ||
    env === "staging" ||
    (typeof process !== "undefined" &&
      (process.env?.ENVIRONMENT === "production" ||
        process.env?.ENVIRONMENT === "staging" ||
        process.env?.VERCEL_ENV === "production" ||
        process.env?.CF_PAGES === "1"));

  if (isStagingOrProduction) {
    if (!secret || secret.trim() === "") {
      throw new Error(
        "SESSION_SECRET is missing. A secure session secret is required in staging and production."
      );
    }
    if (secret === KNOWN_INSECURE_DEV_SECRET) {
      throw new Error(
        "SESSION_SECRET cannot be the default development secret in staging or production."
      );
    }
    if (secret.length < 32) {
      throw new Error(
        "SESSION_SECRET must be at least 32 characters long."
      );
    }
    return secret;
  }

  // Development and test modes:
  if (secret && secret.trim().length > 0) {
    return secret;
  }

  throw new Error(
    "SESSION_SECRET environment variable is missing. Set SESSION_SECRET in your .env.local for local development."
  );
}

function getCryptoSubtle(): SubtleCrypto {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error("Web Crypto subtle is not available in the current environment.");
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const subtle = getCryptoSubtle();
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  return subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Creates an HMAC-SHA256 signed compact token: `payloadBase64.signatureBase64`.
 */
export async function signToken<T extends object>(payload: T, secret?: string): Promise<string> {
  const effectiveSecret = getSessionSecret(secret);
  const subtle = getCryptoSubtle();
  const encoder = new TextEncoder();
  const payloadJson = JSON.stringify(payload);
  const payloadBytes = encoder.encode(payloadJson);
  const payloadB64 = base64UrlEncode(payloadBytes);

  const key = await getHmacKey(effectiveSecret);
  const signatureBuffer = await subtle.sign("HMAC", key, encoder.encode(payloadB64));
  const signatureB64 = base64UrlEncode(signatureBuffer);

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Verifies an HMAC-SHA256 signed compact token.
 * Returns null if the signature is invalid, payload is malformed, token is expired,
 * or the secret is missing/invalid.
 */
export async function verifyToken<T extends { exp?: number }>(
  token: string,
  secret?: string
): Promise<T | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const effectiveSecret = getSessionSecret(secret);
    const [payloadB64, signatureB64] = parts;
    const subtle = getCryptoSubtle();
    const encoder = new TextEncoder();

    const key = await getHmacKey(effectiveSecret);
    const signatureBytes = base64UrlDecode(signatureB64);
    const dataBytes = encoder.encode(payloadB64);

    const isValid = await subtle.verify(
      "HMAC",
      key,
      signatureBytes as unknown as BufferSource,
      dataBytes as unknown as BufferSource
    );
    if (!isValid) return null;

    const payloadBytes = base64UrlDecode(payloadB64);
    const payloadText = new TextDecoder().decode(payloadBytes);
    const payload = JSON.parse(payloadText) as T;

    // Check expiration if present
    if (payload.exp && typeof payload.exp === "number") {
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec > payload.exp) {
        return null; // Expired
      }
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generates an authenticated session token valid for 30 days.
 *
 * `jti` ties the signed token to its server-side `user_sessions` record (see
 * session-store.ts); when omitted, one is generated so standalone callers
 * still get a well-formed payload. Such a token only authenticates once its
 * record exists.
 */
export async function createSessionToken(
  userId: string,
  email: string,
  secret?: string,
  jti?: string
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    jti: jti ?? `ses_${crypto.randomUUID()}`,
    userId,
    email,
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SECONDS, // 30 days
  };
  return signToken(payload, secret);
}

/** Magic-link validity window (seconds). Shared by issuer and record store. */
export const MAGIC_LINK_TTL_SECONDS = 15 * 60;
/** Session validity window (seconds). Shared by issuer, cookie and records. */
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Generates a short-lived magic-link verification token (15 minutes).
 */
export async function createMagicLinkToken(
  email: string,
  secret?: string
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: VerificationTokenPayload = {
    jti: crypto.randomUUID(),
    email,
    purpose: "magic_link",
    iat: nowSec,
    exp: nowSec + MAGIC_LINK_TTL_SECONDS, // 15 minutes
  };
  return signToken(payload, secret);
}

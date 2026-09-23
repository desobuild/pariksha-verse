/**
 * Edge-native Web Crypto HMAC-SHA256 Session and Token Utility.
 * 100% compatible with Cloudflare Workers, Edge Runtime, Next.js, and Node.js.
 * Zero external dependencies, zero Node-only crypto modules.
 */

export interface SessionTokenPayload {
  userId: string;
  email: string;
  exp: number; // Unix timestamp in seconds
  iat: number;
}

export interface VerificationTokenPayload {
  email: string;
  purpose: "magic_link" | "verify_email";
  exp: number; // Unix timestamp in seconds
  iat: number;
}

const DEFAULT_SECRET = "pariksha_verse_dev_secret_key_change_in_production_32b";

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
  const keyData = encoder.encode(secret || DEFAULT_SECRET);
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
export async function signToken<T extends object>(payload: T, secret: string = DEFAULT_SECRET): Promise<string> {
  const subtle = getCryptoSubtle();
  const encoder = new TextEncoder();
  const payloadJson = JSON.stringify(payload);
  const payloadBytes = encoder.encode(payloadJson);
  const payloadB64 = base64UrlEncode(payloadBytes);

  const key = await getHmacKey(secret);
  const signatureBuffer = await subtle.sign("HMAC", key, encoder.encode(payloadB64));
  const signatureB64 = base64UrlEncode(signatureBuffer);

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Verifies an HMAC-SHA256 signed compact token.
 * Returns null if the signature is invalid, payload is malformed, or token is expired.
 */
export async function verifyToken<T extends { exp?: number }>(
  token: string,
  secret: string = DEFAULT_SECRET
): Promise<T | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payloadB64, signatureB64] = parts;
    const subtle = getCryptoSubtle();
    const encoder = new TextEncoder();

    const key = await getHmacKey(secret);
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
 */
export async function createSessionToken(
  userId: string,
  email: string,
  secret?: string
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    userId,
    email,
    iat: nowSec,
    exp: nowSec + 30 * 24 * 60 * 60, // 30 days
  };
  return signToken(payload, secret);
}

/**
 * Generates a short-lived magic-link verification token (15 minutes).
 */
export async function createMagicLinkToken(
  email: string,
  secret?: string
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: VerificationTokenPayload = {
    email,
    purpose: "magic_link",
    iat: nowSec,
    exp: nowSec + 15 * 60, // 15 minutes
  };
  return signToken(payload, secret);
}

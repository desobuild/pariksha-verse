import { describe, it, expect } from "vitest";
import {
  signToken,
  verifyToken,
  createSessionToken,
  createMagicLinkToken,
  type SessionTokenPayload,
  type VerificationTokenPayload,
} from "@/lib/auth/crypto-session";
import {
  extractCookie,
  createSessionCookie,
  createClearSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

describe("Web Crypto Session & Token Service", () => {
  it("generates and verifies HMAC-SHA256 signed session tokens", async () => {
    const userId = "usr_test_123";
    const email = "student@example.com";
    const token = await createSessionToken(userId, email);

    expect(token).toBeDefined();
    expect(token).toContain(".");

    const payload = await verifyToken<SessionTokenPayload>(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe(userId);
    expect(payload?.email).toBe(email);
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("generates and verifies short-lived magic link tokens", async () => {
    const email = "neet_aspirant@parikshaverse.in";
    const token = await createMagicLinkToken(email);

    const payload = await verifyToken<VerificationTokenPayload>(token);
    expect(payload).not.toBeNull();
    expect(payload?.email).toBe(email);
    expect(payload?.purpose).toBe("magic_link");
  });

  it("rejects tampered token payloads", async () => {
    const token = await createSessionToken("usr_legit", "legit@test.com");
    const [payloadB64, signatureB64] = token.split(".");

    // Tamper with payload
    const tamperedPayloadB64 = btoa(JSON.stringify({ userId: "usr_attacker", email: "evil@test.com" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const tamperedToken = `${tamperedPayloadB64}.${signatureB64}`;
    const verified = await verifyToken(tamperedToken);
    expect(verified).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const expiredPayload = {
      userId: "usr_expired",
      email: "old@test.com",
      exp: Math.floor(Date.now() / 1000) - 100, // 100 seconds in past
      iat: Math.floor(Date.now() / 1000) - 200,
    };

    const token = await signToken(expiredPayload);
    const verified = await verifyToken(token);
    expect(verified).toBeNull();
  });

  it("rejects tokens signed with a different secret", async () => {
    const payload = { userId: "usr_1", email: "a@b.com", exp: Math.floor(Date.now() / 1000) + 1000 };
    const token = await signToken(payload, "secret_key_1");
    const verified = await verifyToken(token, "secret_key_2");
    expect(verified).toBeNull();
  });

  it("extracts session cookie correctly from raw cookie header", () => {
    const cookieHeader = `other=abc; ${SESSION_COOKIE_NAME}=signed_token_value_xyz; theme=dark`;
    const extracted = extractCookie(cookieHeader, SESSION_COOKIE_NAME);
    expect(extracted).toBe("signed_token_value_xyz");

    const nonExistent = extractCookie(cookieHeader, "missing_cookie");
    expect(nonExistent).toBeNull();
  });

  it("creates secure session cookie header with HttpOnly and SameSite=Lax", () => {
    const header = createSessionCookie("sample_token", true);
    expect(header).toContain(`${SESSION_COOKIE_NAME}=sample_token`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Secure");
    expect(header).toContain("Path=/");
  });

  it("creates session clear header with Max-Age=0", () => {
    const clearHeader = createClearSessionCookie(true);
    expect(clearHeader).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(clearHeader).toContain("Max-Age=0");
    expect(clearHeader).toContain("Expires=");
  });
});

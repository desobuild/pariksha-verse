import { eq } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import { users } from "@/db/schema";
import { getDb } from "@/db";
import { verifyToken, type SessionTokenPayload } from "./crypto-session";
import type { AuthSession } from "./auth-types";

export const SESSION_COOKIE_NAME = "pv_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Extracts a cookie value by name from a raw cookie string.
 */
export function extractCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return null;
}

/**
 * Creates the Set-Cookie string for setting the authenticated session cookie.
 */
export function createSessionCookie(token: string, isProduction: boolean = false): string {
  const secureFlag = isProduction ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secureFlag}`;
}

/**
 * Creates the Set-Cookie string to clear/invalidate the session cookie on sign-out.
 */
export function createClearSessionCookie(isProduction: boolean = false): string {
  const secureFlag = isProduction ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secureFlag}`;
}

/**
 * Resolves the authenticated user session from a Request, Headers, or raw Cookie string.
 * Strictly derives user identity from the validated cryptographic token and D1 database.
 * Never trusts a client-supplied user ID.
 */
export async function getSession(
  source?: Request | Headers | string | null,
  dbInstance?: DatabaseInstance
): Promise<AuthSession | null> {
  let cookieHeader: string | null = null;

  if (source) {
    if (typeof source === "string") {
      cookieHeader = source;
    } else if ("headers" in source && typeof source.headers?.get === "function") {
      cookieHeader = source.headers.get("cookie");
    } else if (typeof (source as Headers).get === "function") {
      cookieHeader = (source as Headers).get("cookie");
    }
  }

  const token = extractCookie(cookieHeader, SESSION_COOKIE_NAME);
  if (!token) return null;

  const payload = await verifyToken<SessionTokenPayload>(token);
  if (!payload || !payload.userId) return null;

  try {
    const db = dbInstance ?? getDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    const user = rows[0];
    if (!user) return null;

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt instanceof Date ? user.createdAt.getTime() : Number(user.createdAt),
        updatedAt: user.updatedAt instanceof Date ? user.updatedAt.getTime() : Number(user.updatedAt),
      },
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}

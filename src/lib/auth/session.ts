import { and, eq, gt, isNull } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import { users, userSessions } from "@/db/schema";
import { getDb } from "@/db";
import { verifyToken, type SessionTokenPayload } from "./crypto-session";
import type { AuthSession } from "./auth-types";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { logger } from "@/lib/observability/logger";

export const SESSION_COOKIE_NAME = "pv_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Extracts a cookie value by name from a raw cookie string.
 */
export function extractCookie(
  cookieHeader: string | null | undefined,
  name: string
): string | null {
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
 * Determines whether the Secure cookie flag should be set.
 * Dynamically evaluates request URL, forwarded protocol headers, and runtime environment.
 * Ensures HTTPS staging and production environments always enforce Secure,
 * while preserving local HTTP development functionality on localhost.
 */
export function shouldUseSecureCookie(
  source?: boolean | Request | Headers | string | null
): boolean {
  if (typeof source === "boolean") {
    return source;
  }

  // 1. If Request object is provided
  if (source && typeof source === "object" && "url" in source) {
    try {
      const url = new URL(source.url);
      const host = url.hostname.toLowerCase();
      // Allow localhost HTTP development
      if (
        url.protocol === "http:" &&
        (host === "localhost" || host === "127.0.0.1" || host === "::1")
      ) {
        return false;
      }
      if (url.protocol === "https:") {
        return true;
      }
    } catch {
      // Fall through
    }

    if ("headers" in source && typeof source.headers?.get === "function") {
      const forwardedProto = source.headers.get("x-forwarded-proto");
      if (forwardedProto === "https") return true;
      const forwardedHost =
        source.headers.get("x-forwarded-host") || source.headers.get("host") || "";
      if (
        forwardedHost.startsWith("localhost:") ||
        forwardedHost === "localhost" ||
        forwardedHost.startsWith("127.0.0.1:") ||
        forwardedHost === "127.0.0.1"
      ) {
        return false;
      }
    }
  }

  // 2. If Headers object is provided
  if (source && typeof source === "object" && typeof (source as Headers).get === "function") {
    const headers = source as Headers;
    const proto = headers.get("x-forwarded-proto");
    if (proto === "https") return true;
    const host = headers.get("x-forwarded-host") || headers.get("host") || "";
    if (
      host.startsWith("localhost:") ||
      host === "localhost" ||
      host.startsWith("127.0.0.1:") ||
      host === "127.0.0.1"
    ) {
      return false;
    }
  }

  // 3. If raw URL string is provided
  if (
    typeof source === "string" &&
    (source.startsWith("http://") || source.startsWith("https://"))
  ) {
    try {
      const url = new URL(source);
      const host = url.hostname.toLowerCase();
      if (
        url.protocol === "http:" &&
        (host === "localhost" || host === "127.0.0.1" || host === "::1")
      ) {
        return false;
      }
      if (url.protocol === "https:") {
        return true;
      }
    } catch {
      // Fall through
    }
  }

  const isServerOrTest =
    typeof window === "undefined" || !!process.env.VITEST || process.env.NODE_ENV === "test";
  const cfEnv = isServerOrTest ? getCloudflareEnv() : {};
  const env = (
    cfEnv.ENVIRONMENT ||
    (typeof process !== "undefined"
      ? process.env?.ENVIRONMENT || process.env?.NODE_ENV
      : undefined) ||
    "development"
  ).toLowerCase();

  if (env === "production" || env === "staging") {
    return true;
  }

  return false;
}

/**
 * Creates the Set-Cookie string for setting the authenticated session cookie.
 */
export function createSessionCookie(
  token: string,
  secureOrRequest: boolean | Request | Headers | string | null = false
): string {
  const isSecure = shouldUseSecureCookie(secureOrRequest);
  const secureFlag = isSecure ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secureFlag}`;
}

/**
 * Creates the Set-Cookie string to clear/invalidate the session cookie on sign-out.
 */
export function createClearSessionCookie(
  secureOrRequest: boolean | Request | Headers | string | null = false
): string {
  const isSecure = shouldUseSecureCookie(secureOrRequest);
  const secureFlag = isSecure ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secureFlag}`;
}

/**
 * Resolves the authenticated user session from a Request, Headers, or raw Cookie string.
 * Strictly derives user identity from the validated cryptographic token and D1 database.
 * Never trusts a client-supplied user ID.
 *
 * Phase 14E: the signed session payload must carry a `jti` matching a live
 * (unexpired, unrevoked) `user_sessions` record. This is what makes logout
 * revoke a session server-side and kills stolen/replayed cookies. Tokens
 * without a record — including pre-14E sessions and forged jti claims — fail
 * closed.
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
  if (!payload || !payload.userId || !payload.jti) return null;

  try {
    const db = dbInstance ?? getDb();

    // Server-side session lifecycle: the signed jti must resolve to a live
    // record. Revoked (logout) and expired records no longer authenticate.
    const sessionRows = await db
      .select({ id: userSessions.id })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.id, payload.jti),
          isNull(userSessions.revokedAt),
          gt(userSessions.expiresAt, new Date())
        )
      )
      .limit(1);
    if (!sessionRows[0]) return null;

    const rows = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);

    const user = rows[0];
    if (!user) return null;

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt:
          user.createdAt instanceof Date ? user.createdAt.getTime() : Number(user.createdAt),
        updatedAt:
          user.updatedAt instanceof Date ? user.updatedAt.getTime() : Number(user.updatedAt),
      },
      expiresAt: payload.exp * 1000,
    };
  } catch (error) {
    // Phase 14G: a D1 failure previously became an indistinguishable "not
    // authenticated" — it now also leaves a server-side signal. The
    // fail-closed semantics are unchanged (no user data is logged, and the
    // caller still sees null).
    logger.error("db.query.failure", {
      scope: "auth.session",
      error_name: error instanceof Error ? error.name : "UnknownError",
      error_message: error instanceof Error ? error.message : undefined,
    });
    return null;
  }
}

import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import { userSessions } from "@/db/schema";
import { createSessionToken, verifyToken, type SessionTokenPayload } from "./crypto-session";
import { SESSION_COOKIE_NAME, extractCookie } from "./session";
import { logger } from "@/lib/observability/logger";

/**
 * Phase 14E (PART D) — server-side session lifecycle.
 *
 * The pv_session cookie remains the same HMAC-signed token it always was
 * (same secret, same expiry, same cookie flags), but each issued session now
 * also gets a `user_sessions` record keyed by the token's signed `jti`.
 * getSession() requires a live, unrevoked record to match the jti, so:
 *
 * - logout (revokeSession) invalidates the session server-side — a stolen or
 *   replayed cookie stops working immediately;
 * - expired sessions stop resolving even if the signed exp has not lapsed;
 * - sessions issued before Phase 14E (no jti / no record) fail closed and
 *   simply require a fresh sign-in.
 *
 * Raw session tokens are never stored — only the record identifier that the
 * signature itself protects.
 */

export interface IssuedSession {
  /** Signed pv_session cookie value. */
  token: string;
  /** Server-side session record id (the signed jti). */
  sessionId: string;
  /** Absolute session expiry in epoch milliseconds. */
  expiresAt: number;
}

/**
 * Issues a session: signs the token with a fresh jti and creates its
 * server-side record in the same flow. The record insert must succeed for the
 * session to be usable, so issue-then-revoke is always consistent.
 */
export async function issueSession(
  db: DatabaseInstance,
  userId: string,
  email: string
): Promise<IssuedSession> {
  const sessionId = `ses_${crypto.randomUUID()}`;
  const token = await createSessionToken(userId, email, undefined, sessionId);
  const payload = await verifyToken<SessionTokenPayload>(token);
  if (!payload) {
    throw new Error("Failed to issue session: signed payload did not verify.");
  }

  const expiresAt = new Date(payload.exp * 1000);
  await db.insert(userSessions).values({
    id: sessionId,
    userId,
    expiresAt,
    createdAt: new Date(),
  });

  // Opportunistic cleanup so the table cannot grow without bound: drop
  // sessions that expired or were revoked more than 7 days ago. Logins are
  // the only caller, and a failed sweep must never fail a login.
  try {
    await cleanupSessions(db, { now: new Date() });
  } catch (error) {
    // Ignore — the next login retries the sweep. Phase 14G: the failure is
    // still surfaced as a structured event (no user data attached).
    logger.warn("db.cleanup.failed", {
      scope: "user_sessions",
      error_name: error instanceof Error ? error.name : "UnknownError",
    });
  }

  return { token, sessionId, expiresAt: expiresAt.getTime() };
}

/**
 * Revokes a session server-side. Idempotent: revoking an already-revoked or
 * unknown session is a no-op. Logout calls this before clearing the cookie.
 * Returns whether THIS call flipped a live (unrevoked) session — used by
 * sign-out to emit an accurate `auth.session.revoked` event; the value is
 * never exposed to clients.
 */
export async function revokeSession(db: DatabaseInstance, sessionId: string): Promise<boolean> {
  const result = await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)))
    .run();

  const changes = (result as { meta?: { changes?: number } })?.meta?.changes;
  return changes === 1;
}

/**
 * Extracts and verifies the pv_session cookie from a request and revokes its
 * session. Best-effort by design: logout must always succeed from the client's
 * perspective and must not reveal whether the presented cookie was ever valid.
 * Returns whether a live session was actually revoked (observability only —
 * never surfaced in the response).
 */
export async function revokeSessionFromRequest(
  db: DatabaseInstance,
  request: Request
): Promise<boolean> {
  try {
    const token = extractCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);
    if (!token) return false;
    const payload = await verifyToken<SessionTokenPayload>(token);
    if (!payload?.jti) return false;
    return await revokeSession(db, payload.jti);
  } catch (error) {
    // Logout never fails on revocation problems — the cookie clear below is
    // the user-visible contract; server-side revocation is best-effort here.
    logger.warn("auth.session.revoke_failed", {
      error_name: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}

/**
 * Deletes session records that expired, or were revoked, more than the
 * retention window ago.
 */
export async function cleanupSessions(
  db: DatabaseInstance,
  options?: { now?: Date; retentionSeconds?: number }
): Promise<void> {
  const now = options?.now ?? new Date();
  const retentionSeconds = options?.retentionSeconds ?? 7 * 24 * 60 * 60; // 7 days
  const cutoff = new Date(now.getTime() - retentionSeconds * 1000);

  await db
    .delete(userSessions)
    .where(
      or(
        lt(userSessions.expiresAt, cutoff),
        and(isNotNull(userSessions.revokedAt), lt(userSessions.revokedAt, cutoff))
      )
    );
}

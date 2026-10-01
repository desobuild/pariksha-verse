import { NextResponse } from "next/server";
import { createClearSessionCookie } from "@/lib/auth/session";
import { revokeSessionFromRequest } from "@/lib/auth/session-store";
import { getDb } from "@/db";
import { logger } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";

/**
 * Phase 14E (PART D) — logout now invalidates the session server-side.
 *
 * The pv_session record (matched by the signed jti) is revoked in D1, so the
 * same cookie can never authenticate again, even if it was stolen or replayed
 * before logout. The cookie clear remains, and logout stays idempotent and
 * silent about whether the presented cookie was ever valid: an invalid or
 * already-revoked token simply revokes nothing.
 *
 * Phase 14G: `auth.session.revoked` is emitted only when a live session was
 * actually flipped to revoked; requests without a valid session produce no
 * event, so the log cannot be used to probe cookie validity either.
 */
export async function POST(request: Request) {
  try {
    const db = getDb();
    const revoked = await revokeSessionFromRequest(db, request);
    if (revoked) {
      logger.info("auth.session.revoked", {
        request_id: getRequestId(request),
        flow: "sign_out",
      });
    }
  } catch (error) {
    // Revocation is best-effort: logout must always clear the cookie and
    // succeed, and the error path reveals nothing about token validity.
    logger.warn("auth.session.revoke_failed", {
      request_id: getRequestId(request),
      error_name: error instanceof Error ? error.name : "UnknownError",
    });
  }

  const clearCookieHeader = createClearSessionCookie(request);

  const response = NextResponse.json({ success: true, message: "Signed out successfully" });
  response.headers.set("Set-Cookie", clearCookieHeader);
  return response;
}

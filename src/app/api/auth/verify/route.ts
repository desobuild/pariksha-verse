import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyToken, type VerificationTokenPayload } from "@/lib/auth/crypto-session";
import { createSessionCookie } from "@/lib/auth/session";
import { issueSession } from "@/lib/auth/session-store";
import { consumeVerificationToken } from "@/lib/auth/verification-tokens";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  AUTH_RATE_LIMIT_RULES,
  enforceRateLimit,
  getClientIp,
  isRateLimitingEnabled,
  rateLimitExceededResponse,
} from "@/lib/auth/rate-limit";
import { logger } from "@/lib/observability/logger";
import { apiErrorResponse } from "@/lib/observability/api-error";
import { getRequestId } from "@/lib/observability/request-id";

const verifySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
});

const INVALID_TOKEN_RESPONSE = { error: "Invalid or expired verification token" } as const;

export async function POST(request: Request) {
  try {
    const db = getDb();
    const requestId = getRequestId(request);

    // Phase 14E: server-side abuse protection on the credential-verification
    // endpoint. IP is checked before parsing; the submitted email after.
    if (isRateLimitingEnabled()) {
      const ipLimit = await enforceRateLimit(
        db,
        AUTH_RATE_LIMIT_RULES.verifyIp,
        getClientIp(request)
      );
      if (!ipLimit.allowed)
        return rateLimitExceededResponse(ipLimit, {
          request,
          rule: AUTH_RATE_LIMIT_RULES.verifyIp,
        });
    }

    const body = await request.json();
    const result = verifySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid verification payload" }, { status: 400 });
    }

    const { email, token } = result.data;
    const emailLower = email.toLowerCase();

    if (isRateLimitingEnabled()) {
      const emailLimit = await enforceRateLimit(db, AUTH_RATE_LIMIT_RULES.verifyEmail, emailLower);
      if (!emailLimit.allowed)
        return rateLimitExceededResponse(emailLimit, {
          request,
          rule: AUTH_RATE_LIMIT_RULES.verifyEmail,
        });
    }

    // 1. Signature + expiry + claim match (stateless checks, unchanged).
    const payload = await verifyToken<VerificationTokenPayload>(token);

    if (!payload || payload.email.toLowerCase() !== emailLower) {
      // Reason granularity stays in server-side logs; the response is the
      // same generic rejection for every failure mode. Tokens/emails are
      // never logged.
      logger.warn("auth.verification.failed", {
        request_id: requestId,
        reason: payload ? "email_mismatch" : "invalid_or_expired",
      });
      return NextResponse.json(INVALID_TOKEN_RESPONSE, { status: 401 });
    }

    // 2. One-time consumption (atomic server-side record). A valid signature
    // that has already been consumed — including concurrent replays — fails
    // here with the same generic response as every other rejection, so token
    // state is never distinguishable from an invalid token.
    const consumed = await consumeVerificationToken(db, token);
    if (!consumed) {
      logger.warn("auth.verification.failed", {
        request_id: requestId,
        reason: "already_consumed_or_expired",
      });
      return NextResponse.json(INVALID_TOKEN_RESPONSE, { status: 401 });
    }

    const rows = await db.select().from(users).where(eq(users.email, emailLower)).limit(1);

    let user = rows[0];
    if (!user) {
      // Auto-create user if missing
      const now = new Date();
      user = {
        id: `usr_${crypto.randomUUID()}`,
        email: emailLower,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(users).values(user);
      // Operational signal (no email logged): first successful sign-in
      // materializes the user row.
      logger.info("auth.verification.user_autocreated", { request_id: requestId });
    }

    // 3. Issue the authenticated session (signed token + server-side record
    // that makes it revocable — see session-store.ts).
    const session = await issueSession(db, user.id, user.email);
    logger.info("auth.session.created", {
      request_id: requestId,
      flow: "magic_link",
    });
    const cookieHeader = createSessionCookie(session.token, request);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        createdAt:
          user.createdAt instanceof Date ? user.createdAt.getTime() : Number(user.createdAt),
      },
    });

    response.headers.set("Set-Cookie", cookieHeader);
    return response;
  } catch (error) {
    return apiErrorResponse({
      event: "auth.verification.failure",
      error,
      request,
      message: "Verification failed",
    });
  }
}

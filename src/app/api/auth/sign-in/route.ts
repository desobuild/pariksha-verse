import { NextResponse } from "next/server";
import { z } from "zod";
import { createMagicLinkToken } from "@/lib/auth/crypto-session";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendMagicLinkEmail } from "@/lib/email/email-service";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { recordVerificationTokenIssued } from "@/lib/auth/verification-tokens";
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

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(request: Request) {
  try {
    const db = getDb();
    const requestId = getRequestId(request);
    logger.info("auth.signin.requested", { request_id: requestId });

    // Phase 14E: server-side abuse protection. Decisions are made from the
    // client IP (edge-attested on Cloudflare) and the submitted email only.
    if (isRateLimitingEnabled()) {
      const ipLimit = await enforceRateLimit(
        db,
        AUTH_RATE_LIMIT_RULES.signInIp,
        getClientIp(request)
      );
      if (!ipLimit.allowed)
        return rateLimitExceededResponse(ipLimit, {
          request,
          rule: AUTH_RATE_LIMIT_RULES.signInIp,
        });
    }

    const body = await request.json();
    const result = signInSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const email = result.data.email.toLowerCase();

    if (isRateLimitingEnabled()) {
      const emailLimit = await enforceRateLimit(db, AUTH_RATE_LIMIT_RULES.signInEmail, email);
      if (!emailLimit.allowed)
        return rateLimitExceededResponse(emailLimit, {
          request,
          rule: AUTH_RATE_LIMIT_RULES.signInEmail,
        });
    }

    // Check if user exists
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!rows[0]) {
      // Event only — the email itself is never logged (privacy contract).
      logger.warn("auth.signin.account_not_found", { request_id: requestId });
      return NextResponse.json(
        { error: "No account found with this email. Please create an account." },
        { status: 404 }
      );
    }

    // Determine environment bindings and configuration
    const cfEnv = getCloudflareEnv();
    const env = (
      cfEnv.ENVIRONMENT ||
      process.env.ENVIRONMENT ||
      process.env.NODE_ENV ||
      "development"
    ).toLowerCase();
    const isStagingOrProd = env === "production" || env === "staging";
    const allowTestAuthMock =
      !isStagingOrProd &&
      (process.env.ENABLE_TEST_AUTH_MOCK === "true" || cfEnv.ENABLE_TEST_AUTH_MOCK === "true");

    // Generate magic-link / verification token
    const token = await createMagicLinkToken(email);

    // Phase 14E: record the token server-side (digest only) so the verify
    // endpoint can consume it exactly once. The record MUST exist before the
    // token is delivered — a token without a record can never mint a session.
    await recordVerificationTokenIssued(db, { email, token });

    // Build verification URL
    const url = new URL(request.url);
    const appUrl =
      cfEnv.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      `${url.protocol}//${url.host}`;
    const verificationUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    // Deliver token through transactional email provider
    const emailResult = await sendMagicLinkEmail({
      email,
      verificationUrl,
      token,
    });

    if (!emailResult.success) {
      // Delivery-provider detail is not logged: the provider error text can
      // echo the recipient address.
      logger.error("auth.email_delivery.failed", {
        request_id: requestId,
        flow: "sign_in",
      });
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again later." },
        { status: 500 }
      );
    }

    logger.info("auth.signin.issued", { request_id: requestId });

    const responseBody: Record<string, unknown> = {
      success: true,
      message: "Verification code sent to your email.",
    };

    if (allowTestAuthMock) {
      responseBody._testToken = token;
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    return apiErrorResponse({
      event: "auth.signin.failure",
      error,
      request,
      message: "Failed to process sign in request.",
    });
  }
}

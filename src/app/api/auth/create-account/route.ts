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

const createAccountSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(request: Request) {
  try {
    const db = getDb();
    const requestId = getRequestId(request);
    logger.info("auth.createaccount.requested", { request_id: requestId });

    // Phase 14E: server-side abuse protection (see sign-in route).
    if (isRateLimitingEnabled()) {
      const ipLimit = await enforceRateLimit(
        db,
        AUTH_RATE_LIMIT_RULES.createAccountIp,
        getClientIp(request)
      );
      if (!ipLimit.allowed)
        return rateLimitExceededResponse(ipLimit, {
          request,
          rule: AUTH_RATE_LIMIT_RULES.createAccountIp,
        });
    }

    const body = await request.json();
    const result = createAccountSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const email = result.data.email.toLowerCase();

    if (isRateLimitingEnabled()) {
      const emailLimit = await enforceRateLimit(
        db,
        AUTH_RATE_LIMIT_RULES.createAccountEmail,
        email
      );
      if (!emailLimit.allowed)
        return rateLimitExceededResponse(emailLimit, {
          request,
          rule: AUTH_RATE_LIMIT_RULES.createAccountEmail,
        });
    }

    // Check if user already exists
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);

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

    // Build verification URL
    const url = new URL(request.url);
    const appUrl =
      cfEnv.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      `${url.protocol}//${url.host}`;

    // Phase 14E: every issued token is recorded server-side (digest only) so
    // verify can consume it exactly once. Records are created before delivery.
    const issueToken = async (): Promise<string> => {
      const token = await createMagicLinkToken(email);
      await recordVerificationTokenIssued(db, { email, token });
      return token;
    };

    if (existing[0]) {
      // User already exists: send sign in token instead
      const token = await issueToken();
      const verificationUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
      const emailResult = await sendMagicLinkEmail({ email, verificationUrl, token });
      if (!emailResult.success) {
        logger.error("auth.email_delivery.failed", {
          request_id: requestId,
          flow: "create_account_existing",
        });
        return NextResponse.json(
          { error: "Failed to send verification email. Please try again later." },
          { status: 500 }
        );
      }

      logger.info("auth.createaccount.issued", {
        request_id: requestId,
        existing_account: true,
      });

      const responseBody: Record<string, unknown> = {
        success: true,
        message: "Account already exists. Verification link sent to your email.",
      };
      if (allowTestAuthMock) {
        responseBody._testToken = token;
      }
      return NextResponse.json(responseBody);
    }

    // Create minimal user identity
    const now = new Date();
    const newUser = {
      id: `usr_${crypto.randomUUID()}`,
      email,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(users).values(newUser);
    logger.info("auth.createaccount.created", { request_id: requestId });

    const token = await issueToken();
    const verificationUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    const emailResult = await sendMagicLinkEmail({ email, verificationUrl, token });
    if (!emailResult.success) {
      logger.error("auth.email_delivery.failed", {
        request_id: requestId,
        flow: "create_account_new",
      });
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again later." },
        { status: 500 }
      );
    }

    logger.info("auth.createaccount.issued", {
      request_id: requestId,
      existing_account: false,
    });

    const responseBody: Record<string, unknown> = {
      success: true,
      message: "Account created successfully. Verification link sent to your email.",
    };
    if (allowTestAuthMock) {
      responseBody._testToken = token;
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    return apiErrorResponse({
      event: "auth.createaccount.failure",
      error,
      request,
      message: "Failed to create account.",
    });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createMagicLinkToken } from "@/lib/auth/crypto-session";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendMagicLinkEmail } from "@/lib/email/email-service";
import { getCloudflareEnv } from "@/lib/cloudflare/env";

const createAccountSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = createAccountSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const email = result.data.email.toLowerCase();
    const db = getDb();

    // Check if user already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Determine environment bindings and configuration
    const cfEnv = getCloudflareEnv();
    const env = (cfEnv.ENVIRONMENT || process.env.ENVIRONMENT || process.env.NODE_ENV || "development").toLowerCase();
    const isStagingOrProd = env === "production" || env === "staging";
    const allowTestAuthMock =
      !isStagingOrProd &&
      (process.env.ENABLE_TEST_AUTH_MOCK === "true" || cfEnv.ENABLE_TEST_AUTH_MOCK === "true");

    // Build verification URL
    const url = new URL(request.url);
    const appUrl = cfEnv.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;

    if (existing[0]) {
      // User already exists: send sign in token instead
      const token = await createMagicLinkToken(email);
      const verificationUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
      const emailResult = await sendMagicLinkEmail({ email, verificationUrl, token });
      if (!emailResult.success) {
        return NextResponse.json(
          { error: "Failed to send verification email. Please try again later." },
          { status: 500 }
        );
      }

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

    const token = await createMagicLinkToken(email);
    const verificationUrl = `${appUrl}/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    const emailResult = await sendMagicLinkEmail({ email, verificationUrl, token });
    if (!emailResult.success) {
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again later." },
        { status: 500 }
      );
    }

    const responseBody: Record<string, unknown> = {
      success: true,
      message: "Account created successfully. Verification link sent to your email.",
    };
    if (allowTestAuthMock) {
      responseBody._testToken = token;
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create account." },
      { status: 500 }
    );
  }
}

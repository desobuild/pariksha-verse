import { NextResponse } from "next/server";
import { z } from "zod";
import { createMagicLinkToken } from "@/lib/auth/crypto-session";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

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

    if (existing[0]) {
      // User already exists: send sign in token instead
      const token = await createMagicLinkToken(email);
      return NextResponse.json({
        success: true,
        message: "Account already exists. Verification link generated.",
        token,
      });
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

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully.",
        token,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to create account." },
      { status: 500 }
    );
  }
}

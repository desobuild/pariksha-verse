import { NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyToken,
  createSessionToken,
  type VerificationTokenPayload,
} from "@/lib/auth/crypto-session";
import { createSessionCookie } from "@/lib/auth/session";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const verifySchema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = verifySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid verification payload" }, { status: 400 });
    }

    const { email, token } = result.data;
    const payload = await verifyToken<VerificationTokenPayload>(token);

    if (!payload || payload.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Invalid or expired verification token" }, { status: 401 });
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    let user = rows[0];
    if (!user) {
      // Auto-create user if missing
      const now = new Date();
      user = {
        id: `usr_${crypto.randomUUID()}`,
        email: email.toLowerCase(),
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(users).values(user);
    }

    // Generate authenticated session token
    const sessionToken = await createSessionToken(user.id, user.email);
    const cookieHeader = createSessionCookie(sessionToken, request);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt instanceof Date ? user.createdAt.getTime() : Number(user.createdAt),
      },
    });

    response.headers.set("Set-Cookie", cookieHeader);
    return response;
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}

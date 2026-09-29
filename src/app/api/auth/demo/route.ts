import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { createSessionToken } from "@/lib/auth/crypto-session";
import { createSessionCookie } from "@/lib/auth/session";
import {
  ensureStagingDemoWorkspace,
  isStagingDemoAuthEnabled,
  resolveStagingDemoIdentity,
  upsertStagingDemoUser,
} from "@/lib/auth/staging-demo-auth";

/**
 * Phase 13A.3 — Staging-only demo authentication endpoint.
 *
 * Fails closed (404) in every environment except staging, decided purely from
 * trusted server-side configuration. Issues the SAME pv_session cookie used by
 * the production magic-link flow — no verification tokens, no second session
 * mechanism, and no token ever appears in the response body.
 */

// Strict: any attempt to smuggle userId/email/workspace/environment claims is rejected.
const stagingDemoAuthSchema = z
  .object({
    slot: z.string().max(32).optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (!isStagingDemoAuthEnabled()) {
    // Endpoint simply does not exist outside staging.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = stagingDemoAuthSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid demo authentication request" }, { status: 400 });
    }

    // Identity is derived exclusively from the fixed server-side roster;
    // the client may only choose a slot.
    const identity = resolveStagingDemoIdentity(parsed.data.slot);
    if (!identity) {
      return NextResponse.json({ error: "Unknown demo profile" }, { status: 400 });
    }

    const db = getDb();
    const user = await upsertStagingDemoUser(db, identity);
    const workspace = await ensureStagingDemoWorkspace(db, user.id);

    // Normal secure session: SESSION_SECRET HMAC signing, 30-day expiry,
    // HttpOnly + SameSite=Lax (+ Secure on HTTPS) via the shared cookie builder.
    const sessionToken = await createSessionToken(user.id, user.email);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        createdAt:
          user.createdAt instanceof Date ? user.createdAt.getTime() : Number(user.createdAt),
      },
      workspaceId: workspace?.id ?? null,
    });
    response.headers.set("Set-Cookie", createSessionCookie(sessionToken, request));
    return response;
  } catch {
    return NextResponse.json({ error: "Demo authentication failed" }, { status: 500 });
  }
}

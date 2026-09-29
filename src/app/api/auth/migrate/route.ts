import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { executeServerMigration } from "@/lib/auth/guest-migration-server";
import { guestMigrationPayloadSchema } from "@/lib/auth/guest-migration-schema";
import type { GuestMigrationPayload } from "@/lib/auth/auth-types";

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Authentication required for migration." }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = guestMigrationPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid migration payload.",
          details: parseResult.error.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    const payload = parseResult.data as unknown as GuestMigrationPayload;
    const db = getDb();
    const summary = await executeServerMigration(db, session.user.id, payload);

    return NextResponse.json({
      success: true,
      message: "Guest migration completed successfully.",
      summary,
    });
  } catch {
    return NextResponse.json(
      { error: "Migration processing failed on server." },
      { status: 500 }
    );
  }
}

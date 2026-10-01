import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { executeServerMigration } from "@/lib/auth/guest-migration-server";
import { guestMigrationPayloadSchema } from "@/lib/auth/guest-migration-schema";
import type { GuestMigrationPayload } from "@/lib/auth/auth-types";
import { apiErrorResponse } from "@/lib/observability/api-error";
import { logger } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";

export async function POST(request: Request) {
  try {
    const session = await getSession(request);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized. Authentication required for migration." },
        { status: 401 }
      );
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

    // Phase 14G: migration outcome is operationally useful (guest progress
    // merging); only the numeric counters are logged — payload contents stay
    // unlogged. Counters are flattened to one string because some key names
    // (…Sessions…) must not trip the logger's sensitive-key redaction.
    const counts = Object.entries(summary)
      .filter(([, value]) => typeof value === "number")
      .map(([key, value]) => `${key}=${value}`)
      .join(",");
    logger.info("auth.guest_migration.completed", {
      request_id: getRequestId(request),
      counts,
    });

    return NextResponse.json({
      success: true,
      message: "Guest migration completed successfully.",
      summary,
    });
  } catch (error) {
    return apiErrorResponse({
      event: "auth.guest_migration.failure",
      error,
      request,
      message: "Migration processing failed on server.",
    });
  }
}

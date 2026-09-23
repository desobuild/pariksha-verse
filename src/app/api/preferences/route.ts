import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { userPreferences } from "@/db/schema";

const savePreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  dailyStudyGoalMinutes: z.number().int().min(15).max(720).optional(),
  timezone: z.string().min(1).optional(),
  preparationStage: z
    .enum([
      "just_starting",
      "building_fundamentals",
      "practicing_regularly",
      "revising",
      "final_preparation",
    ])
    .nullable()
    .optional(),
});

export async function GET(request: Request) {  const session = await getSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1);

  return NextResponse.json({ preferences: rows[0] ?? null });
}

export async function PUT(request: Request) {
  const session = await getSession(request);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = savePreferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid preferences input" }, { status: 400 });
    }

    const db = getDb();
    const existingRows = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, session.user.id))
      .limit(1);

    if (!existingRows[0]) {
      const inserted = await db
        .insert(userPreferences)
        .values({
          userId: session.user.id,
          theme: parsed.data.theme ?? "system",
          dailyStudyGoalMinutes: parsed.data.dailyStudyGoalMinutes ?? 120,
          timezone: parsed.data.timezone ?? "Asia/Kolkata",
          preparationStage: parsed.data.preparationStage ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return NextResponse.json(inserted[0]);
    }

    const updated = await db
      .update(userPreferences)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(userPreferences.userId, session.user.id))
      .returning();

    return NextResponse.json(updated[0]);  } catch {
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}

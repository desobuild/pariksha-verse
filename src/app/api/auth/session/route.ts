import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const session = await getSession(request);
  return NextResponse.json({
    user: session?.user || null,
    expiresAt: session?.expiresAt || null,
  });
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getStagingDemoAuthOptions, isStagingDemoAuthEnabled } from "@/lib/auth/staging-demo-auth";

export async function GET(request: Request) {
  const session = await getSession(request);
  // The client is only told whether staging demo sign-in is available; the
  // decision is made here from trusted server-side configuration and can never
  // be flipped by client input.
  const demoAuthEnabled = isStagingDemoAuthEnabled();
  return NextResponse.json({
    user: session?.user || null,
    expiresAt: session?.expiresAt || null,
    demoAuth: {
      enabled: demoAuthEnabled,
      options: demoAuthEnabled ? getStagingDemoAuthOptions() : [],
    },
  });
}

import { NextResponse } from "next/server";
import { BRAND } from "@/config/brand";
import { getCloudflareEnv } from "@/lib/cloudflare/env";

export async function GET() {
  const env = getCloudflareEnv();
  const hasD1Binding = Boolean(env.DB);

  return NextResponse.json({
    status: "healthy",
    app: BRAND.name,
    environment: env.ENVIRONMENT || "development",
    timestamp: new Date().toISOString(),
    database: {
      d1Configured: hasD1Binding,
      driver: "drizzle-orm/d1",
    },
  });
}

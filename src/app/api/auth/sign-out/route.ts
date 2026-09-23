import { NextResponse } from "next/server";
import { createClearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  const isProd = process.env.NODE_ENV === "production";
  const clearCookieHeader = createClearSessionCookie(isProd);

  const response = NextResponse.json({ success: true, message: "Signed out successfully" });
  response.headers.set("Set-Cookie", clearCookieHeader);
  return response;
}

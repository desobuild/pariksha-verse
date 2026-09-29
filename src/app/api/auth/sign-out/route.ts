import { NextResponse } from "next/server";
import { createClearSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  const clearCookieHeader = createClearSessionCookie(request);

  const response = NextResponse.json({ success: true, message: "Signed out successfully" });
  response.headers.set("Set-Cookie", clearCookieHeader);
  return response;
}

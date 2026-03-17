import { NextRequest, NextResponse } from "next/server";

/**
 * Simple API authentication via Bearer token.
 * Set API_SECRET in .env.local to enable.
 * If API_SECRET is not set, authentication is skipped (dev mode).
 */
export function authenticateRequest(req: NextRequest): NextResponse | null {
  const secret = process.env.API_SECRET;
  if (!secret) return null; // No secret configured = open access (dev mode)

  const authHeader = req.headers.get("authorization");
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "未授权访问" }, { status: 401 });
  }

  return null; // Auth passed
}

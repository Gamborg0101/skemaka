/**
 * GET /api/auth/mobile/init?redirect=<app-scheme-url>
 *
 * Entry point for the mobile OAuth flow. Validates the app deep-link redirect
 * target, then sends the browser to the login page with a clean, same-origin
 * callbackUrl that NextAuth will accept without stripping.
 *
 * The exp:// (or skemaka://) URL is carried as a query parameter on the
 * callbackUrl so it never passes through NextAuth's URL validator directly.
 */
import { NextRequest, NextResponse } from "next/server"

function isAllowedRedirect(redirect: string): boolean {
  if (redirect.startsWith("skemaka://")) return true
  if (process.env.NODE_ENV !== "production" && redirect.startsWith("exp://")) return true
  return false
}

export async function GET(req: NextRequest) {
  const redirect = req.nextUrl.searchParams.get("redirect")

  if (!redirect) {
    return NextResponse.json({ error: "Missing redirect parameter" }, { status: 400 })
  }

  if (!isAllowedRedirect(redirect)) {
    return NextResponse.json({ error: "Invalid redirect target" }, { status: 400 })
  }

  // Build a clean relative callbackUrl that NextAuth will trust.
  // The exp:// URL is encoded as a query param — NextAuth never inspects it.
  const callbackUrl = `/api/auth/mobile/complete?redirect=${encodeURIComponent(redirect)}`

  return NextResponse.redirect(
    new URL(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, req.nextUrl.origin),
  )
}

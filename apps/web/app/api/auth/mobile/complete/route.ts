/**
 * GET /api/auth/mobile/complete?redirect=<app-scheme-url>
 *
 * Landing page after Google OAuth. NextAuth sets the session cookie and
 * redirects here (via the callbackUrl set by /api/auth/mobile/init).
 *
 * Creates a short-lived one-time code (same pattern as /session) and redirects
 * to the app deep-link with ?code=<code>.  The app calls POST /api/auth/mobile/redeem
 * to exchange the code for the actual session token.
 *
 * The raw session JWT is never placed in the redirect URL, preventing exposure
 * in device logs, intent logs, and analytics SDKs that capture URL events.
 */
import { NextRequest, NextResponse } from "next/server"
import { SignJWT } from "jose"
import { requireAuth } from "@/lib/apiGuard"
import { getToken } from "next-auth/jwt"

function sessionCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"
}

function isAllowedRedirect(redirect: string): boolean {
  if (redirect.startsWith("skemaka://")) return true
  if (process.env.NODE_ENV !== "production" && redirect.startsWith("exp://")) return true
  return false
}

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")

  const name = sessionCookieName()
  const raw = await getToken({ req, secret, salt: name, cookieName: name, raw: true })

  if (!raw) {
    return NextResponse.json({ error: "No session token found" }, { status: 404 })
  }

  const redirect = req.nextUrl.searchParams.get("redirect")

  if (!redirect) {
    return NextResponse.redirect(new URL("/schedule", req.nextUrl.origin))
  }

  if (!isAllowedRedirect(redirect)) {
    return NextResponse.json({ error: "Invalid redirect target" }, { status: 400 })
  }

  // Wrap the session token in a short-lived one-time code JWT (2 min) with a
  // unique jti so /redeem can enforce single-use via Redis.
  const secretBytes = new TextEncoder().encode(secret)
  const code = await new SignJWT({ type: "mobile_auth_code", sessionToken: raw })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(crypto.randomUUID())
    .setExpirationTime("2m")
    .sign(secretBytes)

  const target = new URL(redirect)
  target.searchParams.set("code", code)
  return NextResponse.redirect(target.toString())
}

/**
 * GET /api/auth/mobile/session
 *
 * Two modes, selected by the `redirect` query parameter:
 *
 * 1. Redirect mode  (used by the in-app browser OAuth flow)
 *    ?redirect=skemaka%3A%2F%2Fauth%2Fcallback
 *    → After verifying the session, creates a short-lived one-time code JWT
 *      and redirects to the deep link with ?code=<code> appended.
 *      The app calls POST /api/auth/mobile/redeem to exchange the code for
 *      the actual session token.  This prevents the long-lived token from
 *      appearing in server logs, browser history, or analytics SDKs.
 *
 * 2. JSON mode  (used for programmatic calls, e.g. re-issuing a token)
 *    No redirect param → returns { token, userId, role, orgId }
 *
 * Mobile OAuth flow:
 *   1. App opens a WebView to /api/auth/signin?callbackUrl=<this URL with redirect=>
 *   2. User completes Google OAuth; NextAuth sets the session cookie in the WebView
 *   3. Browser navigates here; cookie is sent automatically
 *   4. This route creates a 2-minute code JWT wrapping the session token
 *   5. Redirects to the app deep link with ?code=<code>
 *   6. App calls POST /api/auth/mobile/redeem with { code } to get the token
 *   7. All subsequent API calls: Authorization: Bearer <token>
 *   8. Before token expires, call POST /api/auth/mobile/refresh
 */
import { NextRequest, NextResponse } from "next/server"
import { SignJWT } from "jose"
import { requireAuth } from "@/lib/apiGuard"
import { getToken } from "next-auth/jwt"

function cookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"
}

export async function GET(req: NextRequest) {
  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")

  const name = cookieName()
  const raw = await getToken({
    req,
    secret,
    salt: name,
    cookieName: name,
    raw: true,
  })

  if (!raw) {
    return NextResponse.json({ error: "No session token found" }, { status: 404 })
  }

  const redirect = req.nextUrl.searchParams.get("redirect")
  if (redirect) {
    // Validate that the redirect target is a registered app scheme or
    // our own origin — never redirect to arbitrary URLs.
    // exp:// is the Expo Go scheme used during development.
    const isAllowed =
      redirect.startsWith("skemaka://") ||
      redirect.startsWith(req.nextUrl.origin) ||
      (process.env.NODE_ENV !== "production" && redirect.startsWith("exp://"))

    if (!isAllowed) {
      return NextResponse.json({ error: "Invalid redirect target" }, { status: 400 })
    }

    // Wrap the session token in a short-lived one-time code JWT (2 min).
    // A unique jti is embedded so /redeem can enforce single-use via Redis.
    // This avoids placing the long-lived session token directly in a URL
    // where it would appear in logs and browser history.
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

  return NextResponse.json({
    token:  raw,
    userId: guard.userId,
    role:   guard.role,
    orgId:  guard.orgId ?? null,
  })
}

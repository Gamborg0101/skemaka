/**
 * GET /api/auth/mobile/session
 *
 * Two modes, selected by the `redirect` query parameter:
 *
 * 1. Redirect mode  (used by the in-app browser OAuth flow)
 *    ?redirect=skemaka%3A%2F%2Fauth%2Fcallback
 *    → After verifying the session, redirects to the deep link with
 *      ?token=<jwt> appended.  The app's Linking handler catches this and
 *      passes the token to signIn().
 *
 * 2. JSON mode  (used for programmatic calls, e.g. re-issuing a token)
 *    No redirect param → returns { token, userId, role, orgId }
 *
 * Mobile OAuth flow:
 *   1. App opens a WebView to /api/auth/signin?callbackUrl=<this URL with redirect=>
 *   2. User completes Google OAuth; NextAuth sets the session cookie in the WebView
 *   3. Browser navigates here; cookie is sent automatically
 *   4. This route reads the raw JWT and redirects to the app deep link
 *   5. App catches the deep link, extracts ?token=, stores in Keychain / Keystore
 *   6. All subsequent API calls: Authorization: Bearer <token>
 *   7. Before token expires, call POST /api/auth/mobile/refresh
 */
import { NextRequest, NextResponse } from "next/server"
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

  const name = cookieName()
  const raw = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? "",
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
    const isAllowed =
      redirect.startsWith("skemaka://") ||
      redirect.startsWith(req.nextUrl.origin)

    if (!isAllowed) {
      return NextResponse.json({ error: "Invalid redirect target" }, { status: 400 })
    }

    const target = new URL(redirect)
    target.searchParams.set("token", raw)
    return NextResponse.redirect(target.toString())
  }

  return NextResponse.json({
    token:  raw,
    userId: guard.userId,
    role:   guard.role,
    orgId:  guard.orgId ?? null,
  })
}

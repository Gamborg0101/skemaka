import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"
import { isSuperadmin } from "@/lib/platform"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth
  const isAuthenticated = !!session?.user
  const userRole = session?.user?.role

  // Stamp every request with a correlation id (honouring an upstream one if a
  // proxy already set it) so route-handler logs can be tied to a single request.
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID()
  const passThrough = () => {
    const headers = new Headers(req.headers)
    headers.set("x-request-id", requestId)
    return NextResponse.next({ request: { headers } })
  }

  // /api/webhooks/* — public, Stripe verifies its own signature
  if (pathname.startsWith("/api/webhooks/")) {
    return passThrough()
  }

  // /api/availability/* — public, token-based
  if (pathname.startsWith("/api/availability/")) {
    return passThrough()
  }

  // API requests with a Bearer token bypass cookie-based middleware auth.
  // Route handlers validate the token themselves via requireAuth / requireOrgMember,
  // which call getToken() and accept both cookies and Authorization: Bearer headers.
  // This lets mobile clients use the API without browser cookies.
  if (pathname.startsWith("/api/") && req.headers.get("authorization")?.startsWith("Bearer ")) {
    return passThrough()
  }

  // /platform/* and /api/platform/* — superadmin only
  if (pathname.startsWith("/platform") || pathname.startsWith("/api/platform/")) {
    if (!isAuthenticated) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      return NextResponse.redirect(new URL("/login", req.nextUrl.origin))
    }
    // Case-insensitive + trimmed, matching isSuperadmin used everywhere else —
    // a strict compare here silently bounced the super admin when the Vercel env
    // value differed in casing/whitespace from their Google email.
    if (!isSuperadmin(session?.user?.email)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      return NextResponse.redirect(new URL("/schedule", req.nextUrl.origin))
    }
    return NextResponse.next()
  }

  // /api/admin/* — must be authenticated + ADMIN role
  if (pathname.startsWith("/api/admin/")) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.next()
  }

  // /api/orgs/* — must be authenticated
  if (pathname.startsWith("/api/orgs/")) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.next()
  }

  // /admin/* — must be authenticated + ADMIN role
  if (pathname.startsWith("/admin/")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login?callbackUrl=" + pathname, req.nextUrl.origin))
    }
    if (userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/schedule", req.nextUrl.origin))
    }
    return NextResponse.next()
  }

  // Public availability token pages — employees without accounts access these
  // Match exactly /availability/[token] (one path segment after /availability/)
  if (/^\/availability\/[^/]+$/.test(pathname)) {
    return NextResponse.next()
  }

  // Manager + shared pages — must be authenticated
  if (
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/employees") ||
    pathname.startsWith("/availability") ||
    pathname.startsWith("/costs") ||
    pathname.startsWith("/time-off") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/billing") ||
    pathname.startsWith("/my-shifts")
  ) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login?callbackUrl=" + pathname, req.nextUrl.origin))
    }
    return NextResponse.next()
  }

  // /api/me/* — must be authenticated
  if (pathname.startsWith("/api/me/")) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.next()
  }

  // /onboarding — must be authenticated; redirect to schedule if already has an org
  // (org check happens inside the page itself via /api/me/context)
  if (pathname.startsWith("/onboarding")) {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login?callbackUrl=/onboarding", req.nextUrl.origin))
    }
    return NextResponse.next()
  }

  // /login — redirect to schedule if already authenticated, but honour an
  // existing same-origin callbackUrl first so the mobile OAuth flow can
  // complete (it routes through /login → /api/auth/mobile/session → exp://…).
  if (pathname === "/login" && isAuthenticated) {
    const cb = req.nextUrl.searchParams.get("callbackUrl")
    if (cb) {
      try {
        const target = cb.startsWith("/") ? new URL(cb, req.nextUrl.origin) : new URL(cb)
        if (target.origin === req.nextUrl.origin) return NextResponse.redirect(target)
      } catch {
        // malformed callbackUrl — fall through to the default redirect
      }
    }
    return NextResponse.redirect(new URL("/schedule", req.nextUrl.origin))
  }

  return passThrough()
})

export const config = {
  matcher: [
    "/login",
    "/schedule/:path*",
    "/employees/:path*",
    "/availability/:path*",
    "/costs/:path*",
    "/time-off/:path*",
    "/settings/:path*",
    "/billing/:path*",
    "/my-shifts/:path*",
    "/admin/:path*",
    "/onboarding/:path*",
    "/platform/:path*",
    "/api/admin/:path*",
    "/api/orgs/:path*",
    "/api/me/:path*",
    "/api/webhooks/:path*",
    "/api/availability/:path*",
    "/api/platform/:path*",
  ],
}

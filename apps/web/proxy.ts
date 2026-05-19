import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth
  const isAuthenticated = !!session?.user
  const userRole = session?.user?.role

  // /api/webhooks/* — public, Stripe verifies its own signature
  if (pathname.startsWith("/api/webhooks/")) {
    return NextResponse.next()
  }

  // /api/availability/* — public, token-based
  if (pathname.startsWith("/api/availability/")) {
    return NextResponse.next()
  }

  // API requests with a Bearer token bypass cookie-based middleware auth.
  // Route handlers validate the token themselves via requireAuth / requireOrgMember,
  // which call getToken() and accept both cookies and Authorization: Bearer headers.
  // This lets mobile clients use the API without browser cookies.
  if (pathname.startsWith("/api/") && req.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.next()
  }

  // /platform/* and /api/platform/* — superadmin only
  if (pathname.startsWith("/platform") || pathname.startsWith("/api/platform/")) {
    if (!isAuthenticated) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      return NextResponse.redirect(new URL("/login", req.nextUrl.origin))
    }
    const userEmail = session?.user?.email
    if (userEmail !== process.env.SUPERADMIN_EMAIL) {
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

  // /login — redirect to schedule if already authenticated
  if (pathname === "/login" && isAuthenticated) {
    return NextResponse.redirect(new URL("/schedule", req.nextUrl.origin))
  }

  return NextResponse.next()
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

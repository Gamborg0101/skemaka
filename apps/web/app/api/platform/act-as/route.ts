/**
 * POST   /api/platform/act-as   { orgId }  — start managing a restaurant as super admin
 * DELETE /api/platform/act-as              — stop managing; return to your own restaurant
 *
 * Super-admin only. Sets/clears the `skemaka_act_as` cookie that tells the rest
 * of the app which restaurant the super admin is currently pointed at. The
 * cookie is inert for anyone who isn't the super admin (see requireOrgMember /
 * getOrgContext, both gated on isSuperadmin).
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { parseBody } from "@/lib/apiGuard"
import { db } from "@/lib/prisma"
import { isSuperadmin, ACTING_ORG_COOKIE } from "@/lib/platform"
import { writeAudit } from "@/lib/services/auditService"

export async function POST(req: NextRequest) {
  const session = await auth()
  const email = session?.user?.email
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSuperadmin(email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = await parseBody(req, z.object({ orgId: z.string().min(1, "orgId is required") }))
  if ("error" in parsed) return parsed.error
  const { orgId } = parsed.data

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { id: true, name: true } })
  if (!org) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 })

  void writeAudit({
    actorUserId:    session.user.id,
    actorEmail:     email!,
    organizationId: org.id,
    orgName:        org.name,
    action:         "ENTER",
  })

  const res = NextResponse.json({ data: { orgId: org.id, orgName: org.name } })
  res.cookies.set(ACTING_ORG_COOKIE, org.id, {
    httpOnly: true,
    sameSite: "lax",
    secure:   process.env.NODE_ENV === "production",
    path:     "/",
    // Session cookie: cleared when the browser closes, or explicitly via Exit.
  })
  return res
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  const email = session?.user?.email
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSuperadmin(email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const priorOrgId = req.cookies.get(ACTING_ORG_COOKIE)?.value
  if (priorOrgId) {
    void writeAudit({
      actorUserId:    session.user.id,
      actorEmail:     email!,
      organizationId: priorOrgId,
      action:         "EXIT",
    })
  }

  const res = NextResponse.json({ data: { ok: true } })
  res.cookies.delete(ACTING_ORG_COOKIE)
  return res
}

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const members = await db.membership.findMany({
    where: { organizationId: orgId, role: "MANAGER" },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { joinedAt: "asc" },
  })

  return NextResponse.json(
    {
      data: members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.user.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    },
    { headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=600" } }
  )
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { orgId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const body = await req.json() as { email?: string }
  const email = body.email?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const target = await db.user.findUnique({ where: { email } })
  if (!target) {
    return NextResponse.json(
      { error: "No account found with that email. Ask them to sign up first." },
      { status: 404 }
    )
  }
  if (target.id === guard.userId) {
    return NextResponse.json({ error: "You already have manager access." }, { status: 409 })
  }

  await db.$transaction([
    db.membership.upsert({
      where: { userId_organizationId: { userId: target.id, organizationId: orgId } },
      create: { userId: target.id, organizationId: orgId, role: "MANAGER" },
      update: { role: "MANAGER" },
    }),
    ...(target.role === "EMPLOYEE"
      ? [db.user.update({ where: { id: target.id }, data: { role: "MANAGER" } })]
      : []),
  ])

  return NextResponse.json({
    data: {
      userId: target.id,
      name: target.name,
      email: target.email,
      role: target.role === "EMPLOYEE" ? "MANAGER" : target.role,
    },
  }, { status: 201 })
}

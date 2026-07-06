import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { isSuperadmin } from "@/lib/platform"

interface RouteContext {
  params: Promise<{ id: string }>
}

async function requireSuperadmin() {
  const session = await auth()
  if (!session?.user?.email) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!isSuperadmin(session.user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true }
}

/** PATCH { status: "OPEN" | "RESOLVED" } — track a bug report. */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const guard = await requireSuperadmin()
  if ("error" in guard) return guard.error

  const { id } = await params

  let body: { status?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (body.status !== "OPEN" && body.status !== "RESOLVED") {
    return NextResponse.json({ error: "status must be OPEN or RESOLVED" }, { status: 400 })
  }

  const existing = await db.bugReport.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await db.bugReport.update({
    where: { id },
    data: {
      status: body.status,
      resolvedAt: body.status === "RESOLVED" ? new Date() : null,
    },
  })

  return NextResponse.json({
    data: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      resolvedAt: updated.resolvedAt ? updated.resolvedAt.toISOString() : null,
    },
  })
}

/** DELETE a single bug report. */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const guard = await requireSuperadmin()
  if ("error" in guard) return guard.error

  const { id } = await params
  await db.bugReport.deleteMany({ where: { id } })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { parseBody } from "@/lib/apiGuard"
import { db } from "@/lib/prisma"
import { isSuperadmin } from "@/lib/platform"

interface RouteContext {
  params: Promise<{ id: string }>
}

const UpdateBugReportSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED"], { message: "status must be OPEN or RESOLVED" }),
})

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

  const parsed = await parseBody(req, UpdateBugReportSchema)
  if ("error" in parsed) return parsed.error
  const { status } = parsed.data

  const existing = await db.bugReport.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await db.bugReport.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === "RESOLVED" ? new Date() : null,
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

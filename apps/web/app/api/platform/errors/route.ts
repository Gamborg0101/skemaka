import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { isSuperadmin } from "@/lib/platform"
import type { Prisma } from "@/app/generated/prisma/client"

async function requireSuperadmin() {
  const session = await auth()
  if (!session?.user?.email) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (!isSuperadmin(session.user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true }
}

export async function GET(req: NextRequest) {
  const guard = await requireSuperadmin()
  if ("error" in guard) return guard.error

  const params = req.nextUrl.searchParams
  const organizationId = params.get("organizationId")
  const status = params.get("status") // "OPEN" | "RESOLVED" | null (=all)
  const q = params.get("q")?.trim()

  const where: Prisma.BugReportWhereInput = {}
  if (organizationId) where.organizationId = organizationId
  if (status === "OPEN" || status === "RESOLVED") where.status = status
  if (q) {
    where.OR = [
      { message: { contains: q, mode: "insensitive" } },
      { errorMessage: { contains: q, mode: "insensitive" } },
      { userEmail: { contains: q, mode: "insensitive" } },
      { userName: { contains: q, mode: "insensitive" } },
      { url: { contains: q, mode: "insensitive" } },
    ]
  }

  const reports = await db.bugReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
  })

  const data = reports.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  }))

  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}

export async function DELETE() {
  const guard = await requireSuperadmin()
  if ("error" in guard) return guard.error

  await db.bugReport.deleteMany({})
  return NextResponse.json({ ok: true })
}

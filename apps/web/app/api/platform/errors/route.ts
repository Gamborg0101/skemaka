import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"

async function requireSuperadmin() {
  const session = await auth()
  if (!session?.user?.email) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  if (session.user.email !== process.env.SUPERADMIN_EMAIL) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true }
}

export async function GET() {
  const guard = await requireSuperadmin()
  if ("error" in guard) return guard.error

  const reports = await db.bugReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
  })

  const data = reports.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
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

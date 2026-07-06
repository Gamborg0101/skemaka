import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isSuperadmin } from "@/lib/platform"
import { listAudit } from "@/lib/services/auditService"

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSuperadmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const data = await listAudit(300)
  return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } })
}

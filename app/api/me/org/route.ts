import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/prisma"
import { serOrg } from "@/lib/serialize"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, role: "MANAGER" },
    include: { organization: true },
    orderBy: { joinedAt: "asc" },
  })

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 })
  }

  return NextResponse.json({ data: serOrg(membership.organization) })
}

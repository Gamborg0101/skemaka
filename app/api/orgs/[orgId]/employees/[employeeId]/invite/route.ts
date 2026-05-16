import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serEmployee } from "@/lib/serialize"
import { sendInviteEmail } from "@/lib/resend"

interface RouteContext {
  params: Promise<{ orgId: string; employeeId: string }>
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { orgId, employeeId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const employee = await db.employee.findFirst({
    where: { id: employeeId, organizationId: orgId, isActive: true },
  })
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  const newToken = crypto.randomUUID()
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const updated = await db.employee.update({
    where: { id: employeeId },
    data: { inviteToken: newToken, inviteExpiry: newExpiry },
  })

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  void sendInviteEmail({
    to: employee.email,
    name: employee.name,
    orgName: org?.name ?? "",
    inviteUrl: `${appUrl}/portal`,
  })

  return NextResponse.json({ data: serEmployee(updated) })
}

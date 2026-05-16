import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/prisma"
import { requireOrgMember } from "@/lib/apiGuard"
import { serTimeOffRequest } from "@/lib/serialize"
import { sendTimeOffApprovedSms, sendTimeOffDeniedSms } from "@/lib/sms"

interface RouteContext {
  params: Promise<{ orgId: string; requestId: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { orgId, requestId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const body = await req.json() as { status?: "APPROVED" | "DENIED"; reviewNote?: string }
  if (!body.status || !["APPROVED", "DENIED"].includes(body.status)) {
    return NextResponse.json({ error: "status must be APPROVED or DENIED" }, { status: 400 })
  }

  const existing = await db.timeOffRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
    include: { employee: { select: { name: true, phone: true } } },
    orderBy: { createdAt: "asc" },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "Request is no longer pending" }, { status: 409 })
  }

  const updated = await db.timeOffRequest.update({
    where: { id: requestId },
    data: { status: body.status, reviewNote: body.reviewNote ?? null },
    include: { employee: { select: { id: true, name: true, jobRole: true } } },
  })

  const { name, phone } = existing.employee
  const startDate = existing.startDate.toISOString().split("T")[0]
  const endDate = existing.endDate.toISOString().split("T")[0]

  if (phone) {
    if (body.status === "APPROVED") {
      void sendTimeOffApprovedSms({ to: phone, employeeName: name.split(" ")[0], startDate, endDate })
    } else {
      void sendTimeOffDeniedSms({ to: phone, employeeName: name.split(" ")[0], startDate, endDate, reviewNote: body.reviewNote })
    }
  }

  return NextResponse.json({ data: serTimeOffRequest(updated) })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { orgId, requestId } = await params
  const guard = await requireOrgMember(orgId)
  if ("error" in guard) return guard.error

  const existing = await db.timeOffRequest.findFirst({
    where: { id: requestId, organizationId: orgId },
    orderBy: { createdAt: "asc" },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.timeOffRequest.delete({ where: { id: requestId } })
  return NextResponse.json({ data: null })
}

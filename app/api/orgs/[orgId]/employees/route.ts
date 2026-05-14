import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { rateLimitRequest } from "@/lib/upstash"
import type { Employee } from "@/types"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

const mockEmployees: Employee[] = [
  {
    id: "emp_mock_001",
    organizationId: "org_mock_001",
    userId: null,
    name: "Alice Hansen",
    email: "alice@example.com",
    phone: "+45 12 34 56 78",
    jobRole: "Barista",
    hourlyWage: 155,
    notes: null,
    employmentType: "PART_TIME" as const,
      contractedHours: 0,
      isActive: true,
    inviteToken: null,
    inviteExpiry: null,
    createdAt: "2025-01-01T08:00:00.000Z",
    updatedAt: "2025-01-01T08:00:00.000Z",
  },
  {
    id: "emp_mock_002",
    organizationId: "org_mock_001",
    userId: null,
    name: "Bob Eriksen",
    email: "bob@example.com",
    phone: null,
    jobRole: "Cashier",
    hourlyWage: 145,
    notes: "Prefers morning shifts",
    employmentType: "PART_TIME" as const,
      contractedHours: 0,
      isActive: true,
    inviteToken: null,
    inviteExpiry: null,
    createdAt: "2025-01-02T08:00:00.000Z",
    updatedAt: "2025-01-02T08:00:00.000Z",
  },
]

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId } = await params

  // TODO: replace with DB query
  // const employees = await db.employee.findMany({
  //   where: { organizationId: orgId, isActive: true },
  //   orderBy: { name: "asc" },
  // })

  const employees = mockEmployees.filter((e) => e.organizationId === orgId || orgId === "org_mock_001")

  return NextResponse.json({ data: employees })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { success } = await rateLimitRequest(req.headers.get("x-forwarded-for") ?? "anonymous")
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const { orgId } = await params

  const body = await req.json() as {
    name?: string
    email?: string
    phone?: string
    jobRole?: string
    hourlyWage?: number
    notes?: string
  }

  const { name, email, jobRole, hourlyWage, phone, notes } = body

  if (!name || !email || !jobRole || hourlyWage === undefined) {
    return NextResponse.json({ error: "name, email, jobRole, and hourlyWage are required" }, { status: 400 })
  }

  const now = new Date().toISOString()

  // TODO: create Employee, update Stripe subscription quantity, send invite email via Resend
  // const inviteToken = crypto.randomUUID()
  // const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  // const employee = await db.employee.create({
  //   data: { organizationId: orgId, name, email, phone, jobRole, hourlyWage, notes, inviteToken, inviteExpiry },
  // })
  // const org = await db.organization.findUnique({ where: { id: orgId } })
  // if (org?.stripeSubscriptionId) {
  //   const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId)
  //   await stripe.subscriptions.update(org.stripeSubscriptionId, {
  //     items: [{ id: sub.items.data[0].id, quantity: org.employeeCount + 1 }],
  //   })
  // }
  // const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/employee/${inviteToken}`
  // await sendInviteEmail({ to: email, name, orgName: org?.name ?? "", inviteUrl })

  const mockEmployee: Employee = {
    id: `emp_mock_${Date.now()}`,
    organizationId: orgId,
    userId: null,
    name,
    email,
    phone: phone ?? null,
    jobRole,
    hourlyWage,
    notes: notes ?? null,
    employmentType: "PART_TIME" as const,
      contractedHours: 0,
      isActive: true,
    inviteToken: "mock_invite_token",
    inviteExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
  }

  return NextResponse.json({ data: mockEmployee }, { status: 201 })
}

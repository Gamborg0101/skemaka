import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import type { AvailabilitySubmission, Employee, AvailabilityDay } from "@/types"

interface RouteContext {
  params: Promise<{ orgId: string; requestId: string }>
}

const mockEmployee: Employee = {
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
}

const mockDays: AvailabilityDay[] = [
  { id: "avday_mock_001", submissionId: "avsub_mock_001", date: "2025-05-19", isAvailable: true, preferredStart: "08:00", preferredEnd: "16:00" },
  { id: "avday_mock_002", submissionId: "avsub_mock_001", date: "2025-05-20", isAvailable: true, preferredStart: null, preferredEnd: null },
  { id: "avday_mock_003", submissionId: "avsub_mock_001", date: "2025-05-21", isAvailable: false, preferredStart: null, preferredEnd: null },
  { id: "avday_mock_004", submissionId: "avsub_mock_001", date: "2025-05-22", isAvailable: true, preferredStart: "10:00", preferredEnd: "18:00" },
  { id: "avday_mock_005", submissionId: "avsub_mock_001", date: "2025-05-23", isAvailable: true, preferredStart: null, preferredEnd: null },
]

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { orgId, requestId } = await params

  // TODO: replace with DB query
  // const submissions = await db.availabilitySubmission.findMany({
  //   where: { requestId, organizationId: orgId },
  //   include: { employee: true, days: { orderBy: { date: "asc" } } },
  //   orderBy: { submittedAt: "asc" },
  // })

  const mockSubmissions: AvailabilitySubmission[] = [
    {
      id: "avsub_mock_001",
      requestId,
      employeeId: "emp_mock_001",
      organizationId: orgId,
      submittedAt: "2025-05-14T12:00:00.000Z",
      employee: mockEmployee,
      days: mockDays,
    },
  ]

  return NextResponse.json({ data: mockSubmissions })
}

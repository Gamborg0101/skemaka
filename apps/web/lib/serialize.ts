import type { Employee, EmbeddedEmployee, Shift, Schedule, Organization, JobRole, ShiftTemplate, EmploymentType, AvailabilityRequest, AvailabilitySubmission, AvailabilityDay, AvailabilityRequestStatus, TimeOffRequest, TimeOffStatus, TimeEntry } from "@/types"

// Prisma returns Decimal for hourlyWage and Date for timestamps.
// These helpers convert to plain serializable types.

export function serEmployee(e: {
  id: string; organizationId: string; userId: string | null
  name: string; email: string; phone: string | null; jobRole: string
  hourlyWage: { toNumber(): number } | number
  employmentType: string; contractedHours: number; notes: string | null
  isActive: boolean
  inviteToken?: string | null   // omit from selects that don't need it
  inviteExpiry?: Date | null    // omit from selects that don't need it
  createdAt: Date; updatedAt: Date
}): Employee {
  return {
    id: e.id,
    organizationId: e.organizationId,
    userId: e.userId,
    name: e.name,
    email: e.email,
    phone: e.phone,
    jobRole: e.jobRole,
    hourlyWage: typeof e.hourlyWage === "number" ? e.hourlyWage : e.hourlyWage.toNumber(),
    employmentType: e.employmentType as EmploymentType,
    contractedHours: e.contractedHours,
    notes: e.notes,
    isActive: e.isActive,
    ...(e.inviteToken !== undefined ? { inviteToken: e.inviteToken } : {}),
    ...(e.inviteExpiry !== undefined ? { inviteExpiry: e.inviteExpiry?.toISOString() ?? null } : {}),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}

export function serShift(s: {
  id: string; scheduleId: string; organizationId: string; employeeId: string
  date: Date; startTime: string; endTime: string; breakMinutes: number
  jobRole: string; notes: string | null; colorTag: string | null
  createdAt: Date; updatedAt: Date
  employee?: { id: string; name: string; jobRole: string }
}): Shift {
  return {
    id: s.id,
    scheduleId: s.scheduleId,
    organizationId: s.organizationId,
    employeeId: s.employeeId,
    date: s.date.toISOString().split("T")[0],
    startTime: s.startTime,
    endTime: s.endTime,
    breakMinutes: s.breakMinutes,
    jobRole: s.jobRole,
    notes: s.notes,
    colorTag: s.colorTag,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    ...(s.employee ? { employee: { id: s.employee.id, name: s.employee.name, jobRole: s.employee.jobRole } satisfies EmbeddedEmployee } : {}),
  }
}

export function serSchedule(s: {
  id: string; organizationId: string; weekStart: Date
  isDuplicate: boolean; sourceScheduleId: string | null
  publishedAt: Date | null
  createdAt: Date; updatedAt: Date
  shifts?: Parameters<typeof serShift>[0][]
}): Schedule {
  return {
    id: s.id,
    organizationId: s.organizationId,
    weekStart: s.weekStart.toISOString().split("T")[0],
    isDuplicate: s.isDuplicate,
    sourceScheduleId: s.sourceScheduleId,
    ...(s.publishedAt ? { publishedAt: s.publishedAt.toISOString() } : {}),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    ...(s.shifts !== undefined ? { shifts: s.shifts.map(serShift) } : {}),
  }
}

export function serOrg(o: {
  id: string; name: string; slug: string; currency: string
  settings?: unknown
  subscriptionStatus: string; employeeCount: number
  createdAt: Date; updatedAt: Date
}): Organization {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    currency: o.currency,
    settings: (o.settings as Organization["settings"]) ?? null,
    subscriptionStatus: o.subscriptionStatus as Organization["subscriptionStatus"],
    employeeCount: o.employeeCount,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  }
}

export function serJobRole(r: {
  id: string; organizationId: string; name: string; color: string
  createdAt: Date; updatedAt: Date
}): JobRole {
  return {
    id: r.id,
    organizationId: r.organizationId,
    name: r.name,
    color: r.color,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

export function serAvailabilityDay(d: {
  id: string; submissionId: string; date: Date
  isAvailable: boolean; preferredStart: string | null; preferredEnd: string | null
}): AvailabilityDay {
  return {
    id: d.id,
    submissionId: d.submissionId,
    date: d.date.toISOString().split("T")[0],
    isAvailable: d.isAvailable,
    preferredStart: d.preferredStart,
    preferredEnd: d.preferredEnd,
  }
}

export function serAvailabilitySubmission(s: {
  id: string; requestId: string; employeeId: string; organizationId: string
  submittedAt: Date
  employee?: { id: string; name: string; jobRole: string }
  days?: Parameters<typeof serAvailabilityDay>[0][]
}): AvailabilitySubmission {
  return {
    id: s.id,
    requestId: s.requestId,
    employeeId: s.employeeId,
    organizationId: s.organizationId,
    submittedAt: s.submittedAt.toISOString(),
    ...(s.employee ? { employee: { id: s.employee.id, name: s.employee.name, jobRole: s.employee.jobRole } satisfies EmbeddedEmployee } : {}),
    ...(s.days !== undefined ? { days: s.days.map(serAvailabilityDay) } : {}),
  }
}

export function serAvailabilityRequest(r: {
  id: string; organizationId: string; weekStart: Date
  deadline: Date; status: string; createdAt: Date
  submissions?: Parameters<typeof serAvailabilitySubmission>[0][]
}): AvailabilityRequest {
  return {
    id: r.id,
    organizationId: r.organizationId,
    weekStart: r.weekStart.toISOString().split("T")[0],
    deadline: r.deadline.toISOString(),
    status: r.status as AvailabilityRequestStatus,
    createdAt: r.createdAt.toISOString(),
    ...(r.submissions !== undefined ? { submissions: r.submissions.map(serAvailabilitySubmission) } : {}),
  }
}

export function serTimeOffRequest(r: {
  id: string; organizationId: string; employeeId: string
  startDate: Date; endDate: Date; reason: string | null
  status: string; reviewNote: string | null
  createdAt: Date; updatedAt: Date
  employee?: { id: string; name: string; jobRole: string }
}): TimeOffRequest {
  return {
    id: r.id,
    organizationId: r.organizationId,
    employeeId: r.employeeId,
    startDate: r.startDate.toISOString().split("T")[0],
    endDate: r.endDate.toISOString().split("T")[0],
    reason: r.reason,
    status: r.status as TimeOffStatus,
    reviewNote: r.reviewNote,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    ...(r.employee ? { employee: { id: r.employee.id, name: r.employee.name, jobRole: r.employee.jobRole } satisfies EmbeddedEmployee } : {}),
  }
}

export function serTimeEntry(e: {
  id: string; organizationId: string; employeeId: string; shiftId: string | null
  clockIn: Date; clockOut: Date | null; breakMinutes: number; note: string | null
  createdAt: Date; updatedAt: Date
  employee?: { id: string; name: string; jobRole: string }
}): TimeEntry {
  return {
    id: e.id,
    organizationId: e.organizationId,
    employeeId: e.employeeId,
    shiftId: e.shiftId,
    clockIn: e.clockIn.toISOString(),
    clockOut: e.clockOut?.toISOString() ?? null,
    breakMinutes: e.breakMinutes,
    note: e.note,
    durationMinutes: e.clockOut
      ? Math.round((e.clockOut.getTime() - e.clockIn.getTime()) / 60000)
      : null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    ...(e.employee ? { employee: { id: e.employee.id, name: e.employee.name, jobRole: e.employee.jobRole } satisfies EmbeddedEmployee } : {}),
  }
}

export function serShiftTemplate(t: {
  id: string; organizationId: string; name: string
  startTime: string; endTime: string; breakMinutes: number
  jobRole: string; colorTag: string | null; sortOrder: number
  createdAt: Date; updatedAt: Date
}): ShiftTemplate {
  return {
    id: t.id,
    organizationId: t.organizationId,
    name: t.name,
    startTime: t.startTime,
    endTime: t.endTime,
    breakMinutes: t.breakMinutes,
    jobRole: t.jobRole,
    colorTag: t.colorTag,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

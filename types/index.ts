// ─── Shift templates ──────────────────────────────────────────────────────────

export interface ShiftTemplate {
  id: string
  organizationId: string
  name: string
  startTime: string
  endTime: string
  breakMinutes: number
  jobRole: string
  colorTag: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = "ADMIN" | "MANAGER" | "EMPLOYEE"
export type MembershipRole = "MANAGER" | "EMPLOYEE"
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED"
export type AvailabilityRequestStatus = "OPEN" | "CLOSED"
export type TimeOffStatus = "PENDING" | "APPROVED" | "DENIED"
export const EMPLOYMENT_TYPES = ["FULL_TIME", "REDUCED_FULL_TIME", "PART_TIME"] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]
export function isEmploymentType(val: string): val is EmploymentType {
  return (EMPLOYMENT_TYPES as readonly string[]).includes(val)
}

// ─── Core entities ────────────────────────────────────────────────────────────

export interface Organization {
  id: string
  name: string
  slug: string
  currency: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: SubscriptionStatus
  employeeCount: number
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  role: UserRole
  createdAt: string
}

export interface Membership {
  id: string
  userId: string
  organizationId: string
  role: MembershipRole
  joinedAt: string
  user?: User
}

export interface Employee {
  id: string
  organizationId: string
  userId: string | null
  name: string
  email: string
  phone: string | null
  jobRole: string
  hourlyWage: number
  employmentType: EmploymentType
  contractedHours: number
  notes: string | null
  isActive: boolean
  inviteToken?: string | null
  inviteExpiry?: string | null
  createdAt: string
  updatedAt: string
}

export interface EmbeddedEmployee {
  id: string
  name: string
  jobRole: string
}

export interface JobRole {
  id: string
  organizationId: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
}

// ─── Scheduling ───────────────────────────────────────────────────────────────

export interface Schedule {
  id: string
  organizationId: string
  weekStart: string
  isDuplicate: boolean
  sourceScheduleId: string | null
  publishedAt?: string
  createdAt: string
  updatedAt: string
  shifts?: Shift[]
}

export interface Shift {
  id: string
  scheduleId: string
  organizationId: string
  employeeId: string
  date: string
  startTime: string
  endTime: string
  breakMinutes: number
  jobRole: string
  notes: string | null
  colorTag: string | null
  createdAt: string
  updatedAt: string
  employee?: Employee
}

// ─── Availability ─────────────────────────────────────────────────────────────

export interface AvailabilityRequest {
  id: string
  organizationId: string
  weekStart: string
  deadline: string
  status: AvailabilityRequestStatus
  createdAt: string
  submissions?: AvailabilitySubmission[]
}

export interface AvailabilitySubmission {
  id: string
  requestId: string
  employeeId: string
  organizationId: string
  submittedAt: string
  employee?: EmbeddedEmployee
  days?: AvailabilityDay[]
}

export interface AvailabilityDay {
  id: string
  submissionId: string
  date: string
  isAvailable: boolean
  preferredStart: string | null
  preferredEnd: string | null
}

// ─── Time-off ─────────────────────────────────────────────────────────────────

export interface TimeOffRequest {
  id: string
  organizationId: string
  employeeId: string
  startDate: string
  endDate: string
  reason: string | null
  status: TimeOffStatus
  reviewNote: string | null
  createdAt: string
  updatedAt: string
  employee?: EmbeddedEmployee
}

// ─── Labor cost ───────────────────────────────────────────────────────────────

export interface LaborCostEntry {
  employee: Employee
  totalHours: number
  totalCost: number
  shifts: Shift[]
}

export interface WeeklyLaborCost {
  weekStart: string
  totalHours: number
  totalCost: number
  entries: LaborCostEntry[]
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
  error?: never
}

export interface ApiError {
  data?: never
  error: string
}

export type ApiResult<T> = ApiResponse<T> | ApiError

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminOrganizationView extends Organization {
  memberCount: number
  activeEmployeeCount: number
}

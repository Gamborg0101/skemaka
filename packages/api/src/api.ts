/**
 * Typed API methods for the Skemaka backend.
 *
 * All functions accept an `ApiClient` instance and return typed results.
 * They are framework-free (no React, no hooks) so they can be used in any
 * context: React Query queryFns, server components, scripts, or tests.
 *
 * Response shapes follow the server's conventions:
 *   - Single-resource endpoints: { data: T }
 *   - List endpoints with pagination: { data: T[], meta: { total, limit, offset } }
 *   - 204 No Content: void
 */
import type { ApiClient } from "./client"
import type {
  Employee,
  Schedule,
  Shift,
  TimeEntry,
  TimeOffRequest,
  AvailabilityRequest,
  AvailabilitySubmission,
  AvailabilityDay,
  DayHours,
  CoverRequest,
} from "@skemaka/types"

export const DEFAULT_ORG_HOURS: DayHours[] = [
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Mon
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Tue
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Wed
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Thu
  { isOpen: true,  openTime: "07:00", closeTime: "21:00" }, // Fri
  { isOpen: true,  openTime: "09:00", closeTime: "17:00" }, // Sat
  { isOpen: false, openTime: "09:00", closeTime: "17:00" }, // Sun
]

export type OpenRequestResult = {
  request: AvailabilityRequest | null
  orgHours: DayHours[]
}

// ─── Response envelope helpers ────────────────────────────────────────────────

type Wrapped<T>  = { data: T }
type Paginated<T> = { data: T[]; meta: { total: number; limit: number; offset: number } }

/**
 * Walk every page of a paginated list endpoint and return the full result set.
 * Consumes the `{ data, meta }` envelope correctly so large lists are never
 * silently truncated (vs. guessing a single "big enough" limit).
 */
async function getAllPages<T>(
  client: ApiClient,
  path: string,
  pageSize = 200,
): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?"
  const all: T[] = []
  let offset = 0
  for (let safety = 0; safety < 10_000; safety++) {
    const res = await client.get<Paginated<T>>(`${path}${sep}limit=${pageSize}&offset=${offset}`)
    const data = res.data ?? []
    all.push(...data)
    offset += res.meta?.limit ?? pageSize
    if (all.length >= (res.meta?.total ?? all.length) || data.length === 0) break
  }
  return all
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type MobileSession = {
  token: string
  userId: string
  role: string
  orgId: string | null
}

/**
 * Exchanges a valid browser session (cookie) for a raw JWT the mobile app
 * can store in SecureStore.  Call from inside the OAuth WebView immediately
 * after sign-in completes.
 */
export async function getMobileSession(client: ApiClient): Promise<MobileSession> {
  return client.get<MobileSession>("/api/auth/mobile/session")
}

export type RefreshResult = {
  token: string
  expiresIn: number
  expiresAt: number
}

/**
 * Refreshes the caller's JWT.  Requires a valid (non-expired) Bearer token.
 * Returns a new token with a fresh expiry window.
 */
export async function refreshMobileToken(client: ApiClient): Promise<RefreshResult> {
  return client.post<RefreshResult>("/api/auth/mobile/refresh")
}

// ─── Current user ─────────────────────────────────────────────────────────────

export type CurrentUser = {
  id: string
  name: string
  email: string
  phone: string | null
  jobRole: string
  /** Org-wide clock format. "24h" (EU default) or "12h" (US AM/PM). */
  timeFormat: "12h" | "24h"
  /** Org industry (lowercase), drives industry-relevant shift quotes. Null if unset. */
  industry: string | null
}

/**
 * Returns the authenticated user's employee profile within the given org.
 * The server resolves the employee record from the JWT's `sub` claim — no
 * employeeId required in the client.
 */
export async function getCurrentUser(
  client: ApiClient,
  orgId: string,
): Promise<CurrentUser> {
  return client.get<CurrentUser>(`/api/orgs/${orgId}/me`)
}

/**
 * Permanently deletes the authenticated user's own account. The caller MUST
 * sign out once this resolves. Throws `ApiError` with status 409 and a
 * human-readable message if the caller is the sole manager of an org (they
 * must add another manager or delete the org first).
 */
export async function deleteAccount(client: ApiClient): Promise<void> {
  return client.del("/api/me/account")
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

/**
 * Returns shifts for the given week that belong to `employeeId`.
 * Fetches the full schedule from the server and filters client-side
 * (the schedule is small and already cached).
 */
export async function getMyShifts(
  client: ApiClient,
  orgId: string,
  weekStart: string,
  employeeId: string,
): Promise<Shift[]> {
  const res = await client.get<Wrapped<Schedule | null>>(
    `/api/orgs/${orgId}/schedules?weekStart=${weekStart}`,
  )
  return (res.data?.shifts ?? []).filter((s) => s.employeeId === employeeId)
}

// ─── Clock in / out ───────────────────────────────────────────────────────────

/**
 * Returns the current open time entry for the authenticated employee,
 * or null if they are not clocked in.
 * Pass `employeeId` when the caller has the MANAGER role and is acting on
 * their own behalf (e.g. a manager using the mobile app in employee view).
 */
export async function getActiveEntry(
  client: ApiClient,
  orgId: string,
  employeeId?: string,
): Promise<TimeEntry | null> {
  const qs = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : ""
  const res = await client.get<Wrapped<TimeEntry | null>>(
    `/api/orgs/${orgId}/time-entries/active${qs}`,
  )
  return res.data ?? null
}

export type ClockInOptions  = { shiftId?: string; note?: string; employeeId?: string }
export type ClockOutOptions = { breakMinutes?: number; note?: string; employeeId?: string }

/**
 * Clocks the authenticated employee in.  The server resolves their employee
 * record from the JWT — no employeeId required for employees.
 * Pass `employeeId` when the caller has the MANAGER role and is clocking
 * themselves in (e.g. a manager using the mobile app in employee view).
 */
export async function clockIn(
  client: ApiClient,
  orgId: string,
  opts: ClockInOptions = {},
): Promise<TimeEntry> {
  const res = await client.post<Wrapped<TimeEntry>>(
    `/api/orgs/${orgId}/time-entries`,
    opts,
  )
  return res.data
}

/**
 * Clocks the authenticated employee out.
 * Pass `employeeId` when the caller has the MANAGER role and is clocking
 * themselves out (e.g. a manager using the mobile app in employee view).
 */
export async function clockOut(
  client: ApiClient,
  orgId: string,
  opts: ClockOutOptions = {},
): Promise<TimeEntry> {
  const res = await client.patch<Wrapped<TimeEntry>>(
    `/api/orgs/${orgId}/time-entries/active`,
    opts,
  )
  return res.data
}

export type UpdateTimeEntryInput = {
  clockIn?: string   // ISO 8601
  clockOut?: string  // ISO 8601
}

/** Manager: correct the clock-in/out timestamps on an existing time entry. */
export async function updateTimeEntry(
  client: ApiClient,
  orgId: string,
  entryId: string,
  input: UpdateTimeEntryInput,
): Promise<TimeEntry> {
  const res = await client.patch<Wrapped<TimeEntry>>(
    `/api/orgs/${orgId}/time-entries/${encodeURIComponent(entryId)}`,
    input,
  )
  return res.data
}

// ─── Availability ─────────────────────────────────────────────────────────────

/**
 * Returns the availability request for a specific week (auto-created if within the
 * org's window), or the most recent OPEN request when no weekStart is given.
 */
export async function getOpenAvailabilityRequest(
  client: ApiClient,
  orgId: string,
  weekStart?: string,
): Promise<OpenRequestResult> {
  if (weekStart) {
    const res = await client.get<{ data: AvailabilityRequest | null; orgHours?: DayHours[] }>(
      `/api/orgs/${orgId}/availability?week=${weekStart}`,
    )
    return { request: res.data ?? null, orgHours: res.orgHours ?? DEFAULT_ORG_HOURS }
  }
  const res = await client.get<Paginated<AvailabilityRequest>>(
    `/api/orgs/${orgId}/availability?status=OPEN&limit=1`,
  )
  return { request: res.data?.[0] ?? null, orgHours: DEFAULT_ORG_HOURS }
}

/**
 * Returns the authenticated user's own submission for the given request, or null.
 * Uses the /my-submission endpoint which resolves the employee from the JWT —
 * no employeeId needed and accessible to all org members (not manager-only).
 */
export async function getMyAvailabilitySubmission(
  client: ApiClient,
  orgId: string,
  requestId: string,
): Promise<AvailabilitySubmission | null> {
  const res = await client.get<{ data: AvailabilitySubmission | null }>(
    `/api/orgs/${orgId}/availability/${requestId}/my-submission`,
  )
  return res.data ?? null
}

export type DayAvailability = Pick<AvailabilityDay, "date" | "isAvailable"> & {
  startTime?: string | null
  endTime?: string | null
}

/**
 * Submits (or re-submits) availability for the given request.
 * Uses the authenticated `/submit` route — no token-based invite link required.
 */
export async function submitAvailability(
  client: ApiClient,
  orgId: string,
  requestId: string,
  days: DayAvailability[],
): Promise<void> {
  await client.post(
    `/api/orgs/${orgId}/availability/${requestId}/submit`,
    { days },
  )
}

// ─── Time off ─────────────────────────────────────────────────────────────────

/**
 * Returns all time-off requests submitted by the given employee.
 */
export async function getMyTimeOff(
  client: ApiClient,
  orgId: string,
  employeeId: string,
): Promise<TimeOffRequest[]> {
  return getAllPages<TimeOffRequest>(
    client,
    `/api/orgs/${orgId}/time-off?employeeId=${employeeId}`,
  )
}

export type TimeOffInput = {
  employeeId: string
  startDate: string
  endDate: string
  reason?: string
}

/**
 * Creates a new time-off request.
 */
export async function submitTimeOffRequest(
  client: ApiClient,
  orgId: string,
  input: TimeOffInput,
): Promise<TimeOffRequest> {
  const res = await client.post<Wrapped<TimeOffRequest>>(
    `/api/orgs/${orgId}/time-off`,
    input,
  )
  return res.data
}

// ─── Manager operations ───────────────────────────────────────────────────────

export type ShiftInput = {
  employeeId: string
  date: string
  startTime: string
  endTime: string
  breakMinutes: number
  jobRole: string
  notes?: string
}

/**
 * Returns the schedule for a given week, or null if none exists.
 */
export async function getSchedule(
  client: ApiClient,
  orgId: string,
  weekStart: string,
): Promise<Schedule | null> {
  const res = await client.get<Wrapped<Schedule | null>>(
    `/api/orgs/${orgId}/schedules?weekStart=${weekStart}`,
  )
  return res.data ?? null
}

/**
 * Returns the schedule for a given week, creating it if it does not exist.
 */
export async function getOrCreateSchedule(
  client: ApiClient,
  orgId: string,
  weekStart: string,
): Promise<Schedule> {
  const existing = await getSchedule(client, orgId, weekStart)
  if (existing) return existing
  const res = await client.post<Wrapped<Schedule>>(
    `/api/orgs/${orgId}/schedules`,
    { weekStart },
  )
  return res.data
}

/**
 * Creates a new shift within the given schedule.
 */
export async function createManagedShift(
  client: ApiClient,
  orgId: string,
  scheduleId: string,
  input: ShiftInput,
): Promise<Shift> {
  const res = await client.post<Wrapped<Shift>>(
    `/api/orgs/${orgId}/schedules/${scheduleId}/shifts`,
    input,
  )
  return res.data
}

/**
 * Updates an existing shift.
 */
export async function updateManagedShift(
  client: ApiClient,
  orgId: string,
  scheduleId: string,
  shiftId: string,
  input: Partial<ShiftInput>,
): Promise<Shift> {
  const res = await client.patch<Wrapped<Shift>>(
    `/api/orgs/${orgId}/schedules/${scheduleId}/shifts/${shiftId}`,
    input,
  )
  return res.data
}

/**
 * Deletes a shift.
 */
export async function deleteManagedShift(
  client: ApiClient,
  orgId: string,
  scheduleId: string,
  shiftId: string,
): Promise<void> {
  await client.del(
    `/api/orgs/${orgId}/schedules/${scheduleId}/shifts/${shiftId}`,
  )
}

/**
 * Lists every employee in the org, paging through the full roster.
 */
export async function listEmployees(
  client: ApiClient,
  orgId: string,
): Promise<Employee[]> {
  return getAllPages<Employee>(client, `/api/orgs/${orgId}/employees`)
}

/**
 * Returns all time-off requests across the org (manager view).
 * Sorted by status so PENDING requests surface first.
 */
export async function getAllTimeOff(
  client: ApiClient,
  orgId: string,
): Promise<TimeOffRequest[]> {
  const items = await getAllPages<TimeOffRequest>(client, `/api/orgs/${orgId}/time-off`)
  // Pending first, then by start date descending
  return [...items].sort((a, b) => {
    if (a.status === "PENDING" && b.status !== "PENDING") return -1
    if (a.status !== "PENDING" && b.status === "PENDING") return 1
    return b.startDate.localeCompare(a.startDate)
  })
}

/**
 * Approves or denies a time-off request (manager only).
 */
export async function reviewTimeOff(
  client: ApiClient,
  orgId: string,
  requestId: string,
  status: "APPROVED" | "DENIED",
  reviewNote?: string,
): Promise<TimeOffRequest> {
  const res = await client.patch<Wrapped<TimeOffRequest>>(
    `/api/orgs/${orgId}/time-off/${requestId}`,
    { status, reviewNote },
  )
  return res.data
}

/**
 * Returns all availability submissions for the given request (manager view).
 */
export async function getAllAvailabilitySubmissions(
  client: ApiClient,
  orgId: string,
  requestId: string,
): Promise<AvailabilitySubmission[]> {
  return getAllPages<AvailabilitySubmission>(
    client,
    `/api/orgs/${orgId}/availability/${requestId}/submissions`,
  )
}

// ─── Shift cover requests (swap pool) ─────────────────────────────────────────

export type CoverLists = { pool: CoverRequest[]; mine: CoverRequest[] }

/** Employee view: the open pool they can claim + their own requests/claims. */
export async function getMyCoverRequests(
  client: ApiClient,
  orgId: string,
): Promise<CoverLists> {
  const res = await client.get<Wrapped<CoverLists>>(`/api/orgs/${orgId}/cover-requests`)
  return res.data
}

/** Manager view: all pending (OPEN + CLAIMED) requests to review. */
export async function getPendingCoverRequests(
  client: ApiClient,
  orgId: string,
): Promise<CoverRequest[]> {
  const res = await client.get<Wrapped<CoverRequest[]>>(`/api/orgs/${orgId}/cover-requests?scope=manager`)
  return res.data
}

/** Offer up one of my own shifts for cover. */
export async function createCoverRequest(
  client: ApiClient,
  orgId: string,
  shiftId: string,
  note?: string | null,
): Promise<CoverRequest> {
  const res = await client.post<Wrapped<CoverRequest>>(
    `/api/orgs/${orgId}/cover-requests`,
    { shiftId, note: note ?? null },
  )
  return res.data
}

/** Offer to cover an open request (pending manager approval). */
export async function claimCoverRequest(
  client: ApiClient,
  orgId: string,
  requestId: string,
): Promise<CoverRequest> {
  const res = await client.post<Wrapped<CoverRequest>>(
    `/api/orgs/${orgId}/cover-requests/${requestId}/claim`,
  )
  return res.data
}

/** Withdraw my own cover request. */
export async function cancelCoverRequest(
  client: ApiClient,
  orgId: string,
  requestId: string,
): Promise<CoverRequest> {
  const res = await client.del(`/api/orgs/${orgId}/cover-requests/${requestId}`)
  return res as unknown as CoverRequest
}

/** Manager: approve a claimed request (reassigns the shift). */
export async function approveCoverRequest(
  client: ApiClient,
  orgId: string,
  requestId: string,
): Promise<CoverRequest> {
  const res = await client.post<Wrapped<CoverRequest>>(
    `/api/orgs/${orgId}/cover-requests/${requestId}/approve`,
  )
  return res.data
}

/** Manager: deny a cover request (shift stays as scheduled). */
export async function denyCoverRequest(
  client: ApiClient,
  orgId: string,
  requestId: string,
): Promise<CoverRequest> {
  const res = await client.post<Wrapped<CoverRequest>>(
    `/api/orgs/${orgId}/cover-requests/${requestId}/deny`,
  )
  return res.data
}

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
  Schedule,
  Shift,
  TimeEntry,
  TimeOffRequest,
  AvailabilityRequest,
  AvailabilitySubmission,
  AvailabilityDay,
} from "@skemaka/types"

// ─── Response envelope helpers ────────────────────────────────────────────────

type Wrapped<T>  = { data: T }
type Paginated<T> = { data: T[]; meta: { total: number; limit: number; offset: number } }

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
 */
export async function getActiveEntry(
  client: ApiClient,
  orgId: string,
): Promise<TimeEntry | null> {
  const res = await client.get<Wrapped<TimeEntry | null>>(
    `/api/orgs/${orgId}/time-entries/active`,
  )
  return res.data ?? null
}

export type ClockInOptions  = { shiftId?: string; note?: string }
export type ClockOutOptions = { breakMinutes?: number; note?: string }

/**
 * Clocks the authenticated employee in.  The server resolves their employee
 * record from the JWT — no employeeId required.
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

// ─── Availability ─────────────────────────────────────────────────────────────

/**
 * Returns the most recent OPEN availability request for the org, or null.
 */
export async function getOpenAvailabilityRequest(
  client: ApiClient,
  orgId: string,
): Promise<AvailabilityRequest | null> {
  const res = await client.get<Paginated<AvailabilityRequest>>(
    `/api/orgs/${orgId}/availability?limit=10`,
  )
  return res.data?.find((r) => r.status === "OPEN") ?? null
}

/**
 * Returns the authenticated employee's submission for the given request, or null.
 */
export async function getMyAvailabilitySubmission(
  client: ApiClient,
  orgId: string,
  requestId: string,
  employeeId: string,
): Promise<AvailabilitySubmission | null> {
  const res = await client.get<Paginated<AvailabilitySubmission>>(
    `/api/orgs/${orgId}/availability/${requestId}/submissions`,
  )
  return res.data?.find((s) => s.employeeId === employeeId) ?? null
}

export type DayAvailability = Pick<AvailabilityDay, "date" | "isAvailable"> & {
  preferredStart?: string | null
  preferredEnd?: string | null
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
  const res = await client.get<Paginated<TimeOffRequest>>(
    `/api/orgs/${orgId}/time-off?employeeId=${employeeId}&limit=50`,
  )
  return res.data ?? []
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

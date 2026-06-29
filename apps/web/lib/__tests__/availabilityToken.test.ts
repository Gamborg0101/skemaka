/**
 * Tests for the PUBLIC, unauthenticated /api/availability/[token] endpoint.
 *
 * The GET test is a regression guard for a real vulnerability: this endpoint
 * once returned the full employee record (hourlyWage, phone, email, notes) to
 * any holder of the token. It must only ever expose id / name / jobRole.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { rateLimitRequest } from "@/lib/upstash"
import * as availabilityService from "@/lib/services/availabilityService"
import { GET, POST } from "@/app/api/availability/[token]/route"

vi.mock("@/lib/upstash", () => ({
  rateLimitRequest: vi.fn(async () => ({ success: true })),
  getClientIp: vi.fn(() => "203.0.113.7"),
}))

vi.mock("@/lib/services/availabilityService", () => ({
  resolveInviteToken: vi.fn(),
  submitAvailability: vi.fn(),
}))

const mockRateLimit = vi.mocked(rateLimitRequest)
const mockResolve = vi.mocked(availabilityService.resolveInviteToken)
const mockSubmit = vi.mocked(availabilityService.submitAvailability)

const SENSITIVE_EMPLOYEE = {
  id: "emp1",
  name: "Anna",
  jobRole: "Barista",
  // none of the following may ever reach an unauthenticated caller
  hourlyWage: 18.5,
  phone: "+4512345678",
  email: "anna@example.com",
  notes: "raise agreed for Q3",
  inviteToken: "tok-secret",
}

const TOKEN_CONTEXT = {
  employeeId: "emp1",
  organizationId: "org1",
  requestId: "req1",
  employee: SENSITIVE_EMPLOYEE,
  request: { id: "req1", weekStart: "2026-06-15", deadline: "2026-06-13", status: "OPEN" },
  orgName: "Café Test",
}

function getReq() {
  return new NextRequest("http://localhost/api/availability/tok-secret")
}

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/availability/tok-secret", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

const ctx = { params: Promise.resolve({ token: "tok-secret" }) }

beforeEach(() => {
  vi.clearAllMocks()
  mockRateLimit.mockResolvedValue({ success: true } as never)
  mockResolve.mockResolvedValue(TOKEN_CONTEXT as never)
})

describe("GET /api/availability/[token]", () => {
  it("never leaks wage, contact details, or notes (PII regression guard)", async () => {
    const res = await GET(getReq(), ctx)
    expect(res.status).toBe(200)

    const raw = await res.text()
    const { data } = JSON.parse(raw)

    expect(Object.keys(data.employee).sort()).toEqual(["id", "jobRole", "name"])
    expect(raw).not.toContain("hourlyWage")
    expect(raw).not.toContain("18.5")
    expect(raw).not.toContain("+4512345678")
    expect(raw).not.toContain("anna@example.com")
    expect(raw).not.toContain("raise agreed")
  })

  it("returns 404 for an invalid or expired token", async () => {
    mockResolve.mockResolvedValue(null)
    const res = await GET(getReq(), ctx)
    expect(res.status).toBe(404)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue({ success: false } as never)
    const res = await GET(getReq(), ctx)
    expect(res.status).toBe(429)
    expect(mockResolve).not.toHaveBeenCalled()
  })
})

describe("POST /api/availability/[token]", () => {
  const validDays = [
    { date: "2026-06-15", isAvailable: true, startTime: "09:00", endTime: "17:00" },
    { date: "2026-06-16", isAvailable: false },
  ]

  it("accepts a valid submission", async () => {
    const res = await POST(postReq({ days: validDays }), ctx)
    expect(res.status).toBe(201)
    expect(mockSubmit).toHaveBeenCalledWith("req1", "emp1", "org1", validDays)
  })

  it("returns 404 for an invalid token", async () => {
    mockResolve.mockResolvedValue(null)
    const res = await POST(postReq({ days: validDays }), ctx)
    expect(res.status).toBe(404)
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  it("returns 409 when the request is no longer open", async () => {
    mockResolve.mockResolvedValue({
      ...TOKEN_CONTEXT,
      request: { ...TOKEN_CONTEXT.request, status: "CLOSED" },
    } as never)
    const res = await POST(postReq({ days: validDays }), ctx)
    expect(res.status).toBe(409)
  })

  it("rejects an empty or missing days array", async () => {
    expect((await POST(postReq({}), ctx)).status).toBe(400)
    expect((await POST(postReq({ days: [] }), ctx)).status).toBe(400)
  })

  it("rejects malformed dates and times", async () => {
    const badDate = [{ date: "15/06/2026", isAvailable: true }]
    expect((await POST(postReq({ days: badDate }), ctx)).status).toBe(400)

    const badTime = [{ date: "2026-06-15", isAvailable: true, startTime: "25:99" }]
    expect((await POST(postReq({ days: badTime }), ctx)).status).toBe(400)
  })

  it("rejects endTime before startTime", async () => {
    const inverted = [{ date: "2026-06-15", isAvailable: true, startTime: "17:00", endTime: "09:00" }]
    expect((await POST(postReq({ days: inverted }), ctx)).status).toBe(400)
    expect(mockSubmit).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import {
  createCoverRequest,
  claimCoverRequest,
  approveCoverRequest,
} from "@/lib/services/coverService"
import { ServiceError } from "@/lib/services/errors"

vi.mock("@/lib/prisma", () => ({
  db: {
    employee: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    shift: { findFirst: vi.fn(), update: vi.fn() },
    organization: { findUnique: vi.fn() },
    shiftCoverRequest: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}))

// Cover-request notifications must not construct a real Twilio client.
vi.mock("@/lib/sms", () => ({
  sendCoverOfferedSms: vi.fn().mockResolvedValue(undefined),
  sendCoverClaimedSms: vi.fn().mockResolvedValue(undefined),
  sendCoverApprovedSms: vi.fn().mockResolvedValue(undefined),
  sendCoverDeniedSms: vi.fn().mockResolvedValue(undefined),
}))

const empFindFirst = vi.mocked(db.employee.findFirst)
const empFindMany = vi.mocked(db.employee.findMany)
const empFindUnique = vi.mocked(db.employee.findUnique)
const shiftFindFirst = vi.mocked(db.shift.findFirst)
const orgFindUnique = vi.mocked(db.organization.findUnique)
const crFindFirst = vi.mocked(db.shiftCoverRequest.findFirst)
const crCreate = vi.mocked(db.shiftCoverRequest.create)
const crUpdate = vi.mocked(db.shiftCoverRequest.update)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const txMock = vi.mocked(db.$transaction as any)

const ORG = "org_1"

function coverRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cr_1",
    organizationId: ORG,
    shiftId: "shift_1",
    requesterEmployeeId: "emp_A",
    claimedByEmployeeId: null,
    status: "OPEN",
    note: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    resolvedAt: null,
    requester: { name: "Alice" },
    claimedBy: null,
    shift: { id: "shift_1", date: new Date("2026-06-15T00:00:00Z"), startTime: "09:00", endTime: "17:00", jobRole: "Server", colorTag: "blue" },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  orgFindUnique.mockResolvedValue({ name: "The Cafe" } as never)
  empFindMany.mockResolvedValue([] as never)
  empFindUnique.mockResolvedValue(null as never)
})

describe("createCoverRequest", () => {
  it("rejects offering a shift the caller doesn't own", async () => {
    empFindFirst.mockResolvedValue({ id: "emp_A", name: "Alice" } as never)
    shiftFindFirst.mockResolvedValue({ id: "shift_1", employeeId: "emp_OTHER", date: new Date("2026-06-15"), startTime: "09:00", endTime: "17:00", jobRole: "Server" } as never)

    await expect(createCoverRequest(ORG, "user_A", "shift_1", null)).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<ServiceError>)
  })

  it("rejects when the shift is already up for cover", async () => {
    empFindFirst.mockResolvedValue({ id: "emp_A", name: "Alice" } as never)
    shiftFindFirst.mockResolvedValue({ id: "shift_1", employeeId: "emp_A", date: new Date("2026-06-15"), startTime: "09:00", endTime: "17:00", jobRole: "Server" } as never)
    crFindFirst.mockResolvedValue({ id: "cr_existing" } as never)

    await expect(createCoverRequest(ORG, "user_A", "shift_1", null)).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("creates an OPEN request for an owned shift", async () => {
    empFindFirst.mockResolvedValue({ id: "emp_A", name: "Alice" } as never)
    shiftFindFirst.mockResolvedValue({ id: "shift_1", employeeId: "emp_A", date: new Date("2026-06-15"), startTime: "09:00", endTime: "17:00", jobRole: "Server" } as never)
    crFindFirst.mockResolvedValue(null as never)
    crCreate.mockResolvedValue(coverRow() as never)

    const result = await createCoverRequest(ORG, "user_A", "shift_1", "please")
    expect(result.status).toBe("OPEN")
    expect(result.shift.date).toBe("2026-06-15")
    expect(crCreate).toHaveBeenCalledOnce()
  })
})

describe("claimCoverRequest", () => {
  it("rejects claiming your own shift", async () => {
    empFindFirst.mockResolvedValue({ id: "emp_A", name: "Alice" } as never)
    crFindFirst.mockResolvedValue(coverRow({ requesterEmployeeId: "emp_A", status: "OPEN" }) as never)

    await expect(claimCoverRequest(ORG, "user_A", "cr_1")).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("rejects claiming a request that isn't OPEN", async () => {
    empFindFirst.mockResolvedValue({ id: "emp_B", name: "Bob" } as never)
    crFindFirst.mockResolvedValue(coverRow({ status: "CLAIMED" }) as never)

    await expect(claimCoverRequest(ORG, "user_B", "cr_1")).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("marks the request CLAIMED by the caller", async () => {
    empFindFirst.mockResolvedValue({ id: "emp_B", name: "Bob" } as never)
    crFindFirst.mockResolvedValue(coverRow({ status: "OPEN" }) as never)
    crUpdate.mockResolvedValue(coverRow({ status: "CLAIMED", claimedByEmployeeId: "emp_B", claimedBy: { name: "Bob" } }) as never)

    const result = await claimCoverRequest(ORG, "user_B", "cr_1")
    expect(result.status).toBe("CLAIMED")
    expect(result.claimedByName).toBe("Bob")
    expect(crUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "CLAIMED", claimedByEmployeeId: "emp_B" },
    }))
  })
})

describe("approveCoverRequest", () => {
  it("rejects approving a request that isn't CLAIMED", async () => {
    crFindFirst.mockResolvedValue(coverRow({ status: "OPEN" }) as never)
    await expect(approveCoverRequest(ORG, "mgr_1", "cr_1")).rejects.toMatchObject({ code: "CONFLICT" })
  })

  it("reassigns the shift to the claimer and marks APPROVED", async () => {
    crFindFirst.mockResolvedValue(coverRow({ status: "CLAIMED", claimedByEmployeeId: "emp_B", claimedBy: { name: "Bob" } }) as never)
    const shiftUpdate = vi.fn().mockResolvedValue({})
    const crTxUpdate = vi.fn().mockResolvedValue(coverRow({ status: "APPROVED", claimedByEmployeeId: "emp_B", claimedBy: { name: "Bob" }, resolvedAt: new Date() }))
    txMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ shift: { update: shiftUpdate }, shiftCoverRequest: { update: crTxUpdate } }),
    )

    const result = await approveCoverRequest(ORG, "mgr_1", "cr_1")
    expect(result.status).toBe("APPROVED")
    // The shift must be reassigned to the claimer.
    expect(shiftUpdate).toHaveBeenCalledWith({ where: { id: "shift_1" }, data: { employeeId: "emp_B" } })
  })
})

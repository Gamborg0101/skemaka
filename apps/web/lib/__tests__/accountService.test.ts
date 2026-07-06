import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/prisma"
import { cancelSubscriptionSafe } from "@/lib/services/billingService"
import { deleteAccount } from "@/lib/services/accountService"

vi.mock("@/lib/prisma", () => ({
  db: {
    membership: { findMany: vi.fn(), groupBy: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock("@/lib/services/billingService", () => ({
  cancelSubscriptionSafe: vi.fn().mockResolvedValue(true),
}))

const memFindMany = vi.mocked(db.membership.findMany)
const memGroupBy = vi.mocked(db.membership.groupBy)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const txMock = vi.mocked(db.$transaction as any)
const cancel = vi.mocked(cancelSubscriptionSafe)

const USER = "user_1"

// Fake transaction client whose delegates we can assert on.
function fakeTx() {
  return {
    organization: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    employee: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    user: { delete: vi.fn().mockResolvedValue({}) },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  cancel.mockResolvedValue(true)
})

describe("deleteAccount", () => {
  it("deletes a solely-managed org (cascade), cancels its subscription, and deletes the user", async () => {
    memFindMany.mockResolvedValue([
      { organization: { id: "org1", name: "Org One", stripeSubscriptionId: "sub_1" } },
    ] as never)
    memGroupBy.mockResolvedValue([{ organizationId: "org1", _count: { userId: 1 } }] as never)

    const tx = fakeTx()
    txMock.mockImplementation(async (cb: (c: unknown) => unknown) => cb(tx))

    const result = await deleteAccount(USER)

    expect(cancel).toHaveBeenCalledWith("sub_1")
    expect(tx.organization.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["org1"] } } })
    expect(tx.employee.updateMany).toHaveBeenCalledWith({ where: { userId: USER }, data: { userId: null } })
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: USER } })
    expect(result).toEqual({ deleted: true, deletedOrgs: ["Org One"], keptOrgs: [] })
  })

  it("preserves a co-managed org (only removes the user) but still deletes the account", async () => {
    memFindMany.mockResolvedValue([
      { organization: { id: "org1", name: "Shared Co", stripeSubscriptionId: null } },
    ] as never)
    memGroupBy.mockResolvedValue([{ organizationId: "org1", _count: { userId: 2 } }] as never)

    const tx = fakeTx()
    txMock.mockImplementation(async (cb: (c: unknown) => unknown) => cb(tx))

    const result = await deleteAccount(USER)

    expect(cancel).not.toHaveBeenCalled()
    expect(tx.organization.deleteMany).not.toHaveBeenCalled()
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: USER } })
    expect(result).toEqual({ deleted: true, deletedOrgs: [], keptOrgs: ["Shared Co"] })
  })

  it("deletes a plain user with no managed orgs", async () => {
    memFindMany.mockResolvedValue([] as never)

    const tx = fakeTx()
    txMock.mockImplementation(async (cb: (c: unknown) => unknown) => cb(tx))

    const result = await deleteAccount(USER)

    expect(memGroupBy).not.toHaveBeenCalled()
    expect(tx.organization.deleteMany).not.toHaveBeenCalled()
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: USER } })
    expect(result).toEqual({ deleted: true, deletedOrgs: [], keptOrgs: [] })
  })
})

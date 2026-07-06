import { db } from "@/lib/prisma"
import { PrismaClient } from "@/app/generated/prisma/client"
import { cancelSubscriptionSafe } from "./billingService"

export type DeleteAccountResult = {
  deleted: true
  /** Names of organisations that were deleted (ones the user solely managed). */
  deletedOrgs: string[]
  /** Organisations left intact because they have other managers. */
  keptOrgs: string[]
}

/**
 * Permanently delete a user's account and everything that belongs to it.
 *
 * - Organisations the user is the ONLY manager of are deleted outright. The
 *   Organization FK cascade removes every child row (employees, schedules,
 *   shifts, availability, time-off, cover requests, shift templates, time
 *   entries, scheduling events, memberships, …), and any Stripe subscription is
 *   cancelled first so billing stops.
 * - Organisations with other managers are left intact; the user is simply
 *   removed from them (their Membership cascades when the User row is deleted).
 *   We don't delete a shared workspace out from under co-managers.
 * - The User row is deleted last, cascading Account, Session and remaining
 *   Membership rows. Employee.userId is nulled first (optional FK, no cascade).
 *
 * Irreversible. Callers must sign the user out afterwards.
 */
export async function deleteAccount(userId: string): Promise<DeleteAccountResult> {
  // Orgs this user manages, with the total manager count for each.
  const managerMemberships = await db.membership.findMany({
    where: { userId, role: "MANAGER" },
    select: { organization: { select: { id: true, name: true, stripeSubscriptionId: true } } },
  })

  const deletedOrgs: { id: string; name: string; stripeSubscriptionId: string | null }[] = []
  const keptOrgs: string[] = []

  if (managerMemberships.length > 0) {
    const orgIds = managerMemberships.map((m) => m.organization.id)
    const managerCounts = await db.membership.groupBy({
      by: ["organizationId"],
      where: { organizationId: { in: orgIds }, role: "MANAGER" },
      _count: { userId: true },
    })
    const countByOrg = new Map<string, number>(
      managerCounts.map((r) => [r.organizationId, r._count.userId]),
    )

    for (const m of managerMemberships) {
      if ((countByOrg.get(m.organization.id) ?? 0) <= 1) {
        deletedOrgs.push(m.organization)
      } else {
        keptOrgs.push(m.organization.name)
      }
    }
  }

  // Cancel Stripe subscriptions BEFORE deleting the orgs (best-effort — a Stripe
  // outage must not strand the user; failures are logged inside the helper).
  await Promise.all(
    deletedOrgs.map((o) => cancelSubscriptionSafe(o.stripeSubscriptionId)),
  )

  await db.$transaction(async (tx) => {
    // Prisma 7 types the tx param as Omit<PrismaClient, ITXClientDenyList>; cast
    // so tsc can see the delegates (runtime value is a real PrismaClient).
    const client = tx as unknown as PrismaClient

    // Delete solely-managed orgs — cascades to all their members and bookings.
    if (deletedOrgs.length > 0) {
      await client.organization.deleteMany({ where: { id: { in: deletedOrgs.map((o) => o.id) } } })
    }

    // Unlink any employee records still pointing at this user (co-managed orgs
    // and any org where the user is also an employee). Employee.userId is an
    // optional FK with no cascade, so null it explicitly.
    await client.employee.updateMany({ where: { userId }, data: { userId: null } })

    // Delete the user last — cascades Account, Session and remaining Memberships.
    await client.user.delete({ where: { id: userId } })
  })

  return { deleted: true, deletedOrgs: deletedOrgs.map((o) => o.name), keptOrgs }
}

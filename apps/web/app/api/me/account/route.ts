/**
 * DELETE /api/me/account
 *
 * Permanently deletes the authenticated user's own account.
 *
 * Policy:
 *   - Blocked (409) if the caller is the sole MANAGER of one or more orgs.
 *     They must either add another manager or delete the org first.
 *   - Otherwise, the account is deleted inside a single transaction.
 *
 * What gets deleted vs. unlinked:
 *   Deleted (direct):
 *     - User row
 *   Deleted (cascade via onDelete: Cascade on the foreign key):
 *     - Account rows       — Account.user   @relation ... onDelete: Cascade
 *     - Session rows       — Session.user   @relation ... onDelete: Cascade
 *     - Membership rows    — Membership.user @relation ... onDelete: Cascade
 *   Unlinked (explicit, before user delete):
 *     - Employee.userId set to null — Employee.user is OPTIONAL (userId String?),
 *       no onDelete action defined; we do this explicitly for safety and clarity
 *       rather than relying on DB defaults.
 *   Set to null (cascade):
 *     - BugReport.userId   — BugReport.user @relation ... onDelete: SetNull
 *
 * Response:
 *   200  { deleted: true }
 *   401  Not authenticated
 *   409  Sole-manager block — { error, code: "SOLE_MANAGER", orgs: string[] }
 *   429  Rate limited
 *   500  Unexpected server error
 *
 * Mobile:
 *   Accepts Authorization: Bearer <token>. The middleware Bearer branch at
 *   proxy.ts:27 lets the request through; requireAuth() decodes the token.
 *   The mobile client must sign out after receiving 200.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiGuard"
import { db } from "@/lib/prisma"
import { PrismaClient } from "@/app/generated/prisma/client"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { logError, requestIdFrom } from "@/lib/log"

type MembershipWithOrg = {
  organizationId: string
  organization: { id: string; name: string }
}

type GroupByResult = {
  organizationId: string
  _count: { userId: number }
}

export async function DELETE(req: NextRequest) {
  // ── 1. Rate-limit ──────────────────────────────────────────────────────────
  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  // ── 2. Auth ────────────────────────────────────────────────────────────────
  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  const { userId } = guard

  try {
    // ── 3. Sole-manager check ────────────────────────────────────────────────
    //
    // Find every org where this user is a MANAGER.
    // Then, for each of those orgs, count how many MANAGER memberships it has.
    // If any org has exactly 1 MANAGER (i.e. this user), block the deletion.

    const userManagerMemberships: MembershipWithOrg[] = await db.membership.findMany({
      where: { userId, role: "MANAGER" },
      select: {
        organizationId: true,
        organization: { select: { id: true, name: true } },
      },
    })

    if (userManagerMemberships.length > 0) {
      // Count MANAGER memberships for each org the user manages in one query.
      const managerCounts = await db.membership.groupBy({
        by: ["organizationId"],
        where: {
          organizationId: { in: userManagerMemberships.map((m: MembershipWithOrg) => m.organizationId) },
          role: "MANAGER",
        },
        _count: { userId: true },
      })

      // Build a lookup: orgId → total manager count
      const countByOrg = new Map<string, number>(
        managerCounts.map((r: GroupByResult) => [r.organizationId, r._count.userId]),
      )

      // Orgs where this user is the ONLY manager
      const soleManagerOrgs: string[] = userManagerMemberships
        .filter((m: MembershipWithOrg) => (countByOrg.get(m.organizationId) ?? 0) <= 1)
        .map((m: MembershipWithOrg) => m.organization.name)

      if (soleManagerOrgs.length > 0) {
        const orgList = soleManagerOrgs.map((n: string) => `"${n}"`).join(", ")
        const plural  = soleManagerOrgs.length === 1 ? "organisation" : "organisations"
        return NextResponse.json(
          {
            error: `You are the only manager of ${orgList}. Add another manager or delete the ${plural} before deleting your account.`,
            code:  "SOLE_MANAGER",
            orgs:  soleManagerOrgs,
          },
          { status: 409 },
        )
      }
    }

    // ── 4. Delete in a transaction ───────────────────────────────────────────
    //
    // Step A: Explicitly unlink Employee records. Employee.userId is optional
    //         (String?) with no onDelete action on the FK — the field would be
    //         left dangling if we relied on the DB default. Be explicit.
    //
    // Step B: Delete the User. This cascades:
    //         - Account   (onDelete: Cascade)
    //         - Session   (onDelete: Cascade)
    //         - Membership (onDelete: Cascade)
    //   BugReport.userId is set to null by the DB (onDelete: SetNull).
    //
    // The Prisma 7 generated client types the $transaction callback parameter
    // as `Omit<PrismaClient, ITXClientDenyList>` — tsc cannot see delegate
    // properties through Omit on a class. Cast to PrismaClient (safe: the
    // runtime value IS a PrismaClient minus the denied methods).

    await db.$transaction(async (tx) => {
      const client = tx as unknown as PrismaClient

      await client.employee.updateMany({
        where: { userId },
        data:  { userId: null },
      })

      await client.user.delete({ where: { id: userId } })
    })

    return NextResponse.json({ deleted: true }, { status: 200 })
  } catch (err) {
    logError("DELETE /api/me/account", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}

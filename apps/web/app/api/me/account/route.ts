/**
 * DELETE /api/me/account
 *
 * Permanently deletes the authenticated user's account and everything that
 * belongs to it. Irreversible — the client MUST sign out after a 200.
 *
 * What gets deleted:
 *   - Every organisation the user is the ONLY manager of, including all of its
 *     employees, schedules, shifts, availability, time-off, cover requests,
 *     shift templates, time entries and scheduling events (via the Organization
 *     FK cascade). Any Stripe subscription on those orgs is cancelled first.
 *   - The User row, cascading its Account, Session and remaining Membership rows.
 *
 * What is preserved:
 *   - Organisations that have other managers are left intact; the user is just
 *     removed from them. We don't delete a shared workspace out from under
 *     co-managers.
 *
 * Response:
 *   200  { deleted: true, deletedOrgs: string[], keptOrgs: string[] }
 *   401  Not authenticated
 *   429  Rate limited
 *   500  Unexpected server error
 *
 * Mobile: accepts Authorization: Bearer <token>; sign out after 200.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/apiGuard"
import { rateLimitRequest, getClientIp } from "@/lib/upstash"
import { deleteAccount } from "@/lib/services/accountService"
import { logError, requestIdFrom } from "@/lib/log"

export async function DELETE(req: NextRequest) {
  const { success } = await rateLimitRequest(getClientIp(req.headers), "mutation")
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  const guard = await requireAuth(req)
  if ("error" in guard) return guard.error

  try {
    const result = await deleteAccount(guard.userId)
    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    logError("DELETE /api/me/account", err, { requestId: requestIdFrom(req.headers) })
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}

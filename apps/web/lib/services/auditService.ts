import "server-only"
import { db } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"

export type AuditAction = "ENTER" | "EXIT" | "MUTATE"

export interface AuditInput {
  actorUserId?: string | null
  actorEmail: string
  organizationId?: string | null
  orgName?: string | null
  action: AuditAction
  method?: string | null
  path?: string | null
  metadata?: Prisma.InputJsonValue
}

/**
 * Record a super-admin action. Fire-and-forget by design: auditing must never
 * block or fail the underlying request, so callers `void writeAudit(...)` and a
 * DB hiccup only costs a log line, not the operation.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await db.superAdminAudit.create({
      data: {
        actorUserId:    input.actorUserId ?? null,
        actorEmail:     input.actorEmail,
        organizationId: input.organizationId ?? null,
        orgName:        input.orgName ?? null,
        action:         input.action,
        method:         input.method ?? null,
        path:           input.path ?? null,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    })
  } catch (err) {
    console.error("[audit] failed to write super-admin audit row:", err)
  }
}

export interface AuditRow {
  id: string
  actorEmail: string
  organizationId: string | null
  orgName: string | null
  action: string
  method: string | null
  path: string | null
  createdAt: string
}

/** Most recent audit rows, newest first, with restaurant names filled in. */
export async function listAudit(limit = 300): Promise<AuditRow[]> {
  const rows = await db.superAdminAudit.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  // MUTATE rows store only organizationId (to keep the auth guard fast); resolve
  // names in one batched lookup so the audit view reads cleanly.
  const missingNameOrgIds = [
    ...new Set(
      rows.filter((r) => r.organizationId && !r.orgName).map((r) => r.organizationId as string),
    ),
  ]
  const nameById = new Map<string, string>()
  if (missingNameOrgIds.length > 0) {
    const orgs = await db.organization.findMany({
      where: { id: { in: missingNameOrgIds } },
      select: { id: true, name: true },
    })
    for (const o of orgs) nameById.set(o.id, o.name)
  }

  return rows.map((r) => ({
    id:             r.id,
    actorEmail:     r.actorEmail,
    organizationId: r.organizationId,
    orgName:        r.orgName ?? (r.organizationId ? nameById.get(r.organizationId) ?? null : null),
    action:         r.action,
    method:         r.method,
    path:           r.path,
    createdAt:      r.createdAt.toISOString(),
  }))
}

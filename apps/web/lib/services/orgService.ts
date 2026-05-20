import { db } from "@/lib/prisma"
import { Prisma } from "@/app/generated/prisma/client"
import { serOrg, serJobRole, serShiftTemplate } from "@/lib/serialize"
import { seedDefaultRoles } from "@/lib/seedDefaultRoles"
import type { Organization, JobRole, ShiftTemplate, OrgScheduleSettings } from "@/types"
import { ServiceError } from "./errors"

// ── Organization ──────────────────────────────────────────────────────────────

const VALID_CURRENCIES = ["EUR", "USD", "GBP", "DKK", "SEK", "NOK"] as const

export async function createOrg(
  userId: string,
  name: string,
  currency?: string,
): Promise<Organization> {
  const trimmedName     = name.trim()
  const resolvedCurrency = currency && (VALID_CURRENCIES as readonly string[]).includes(currency) ? currency : "EUR"
  const baseSlug        = trimmedName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")

  let slug   = baseSlug || "org"
  let suffix = 1
  const MAX_SLUG_ATTEMPTS = 20
  while (await db.organization.findUnique({ where: { slug } })) {
    if (suffix > MAX_SLUG_ATTEMPTS) throw new ServiceError("Could not generate a unique slug", "CONFLICT")
    slug = `${baseSlug || "org"}-${suffix++}`
  }

  const org = await db.organization.create({
    data: { name: trimmedName, slug, currency: resolvedCurrency },
  })

  await db.membership.create({
    data: { userId, organizationId: org.id, role: "MANAGER" },
  })

  await seedDefaultRoles(org.id)

  return serOrg(org)
}

export async function updateOrgCurrency(orgId: string, newCurrency: string): Promise<Organization> {
  const org = await db.organization.findFirst({
    where: { id: orgId },
    orderBy: { createdAt: "asc" },
  })
  if (!org) throw new ServiceError("Not found", "NOT_FOUND")
  if (org.currency === newCurrency) return serOrg(org)

  let rate: number
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${org.currency}&to=${newCurrency}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) throw new Error("rate fetch failed")
    const data = await res.json() as { rates: Record<string, number> }
    rate = data.rates[newCurrency]
    if (!rate) throw new Error("rate not in response")
  } catch {
    throw new ServiceError("Could not fetch exchange rate. Try again.", "UPSTREAM")
  }

  await db.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: orgId }, data: { currency: newCurrency } })
    await tx.$executeRaw(Prisma.sql`
      UPDATE "Employee"
      SET "hourlyWage" = ROUND("hourlyWage" * ${rate}::numeric, 2)
      WHERE "organizationId" = ${orgId}
    `)
  })

  const updated = await db.organization.findFirst({ where: { id: orgId }, orderBy: { createdAt: "asc" } })
  return serOrg(updated!)
}

export type OrgSettingsPatch = {
  hours?:               Array<{ isOpen: boolean; openTime: string; closeTime: string }>
  defaultScheduleView?: "week" | "timeline"
  timeOffEnabled?:      boolean
}

export async function updateOrgSettings(
  orgId: string,
  patch: OrgSettingsPatch,
): Promise<OrgScheduleSettings> {
  const org     = await db.organization.findUnique({ where: { id: orgId }, select: { settings: true } })
  const current = (org?.settings as OrgScheduleSettings) ?? {}
  const merged: OrgScheduleSettings = { ...current }

  if (patch.hours               !== undefined) merged.hours               = patch.hours
  if (patch.defaultScheduleView !== undefined) merged.defaultScheduleView = patch.defaultScheduleView
  if (patch.timeOffEnabled      !== undefined) merged.timeOffEnabled      = patch.timeOffEnabled

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.organization.update({ where: { id: orgId }, data: { settings: merged as any } })

  return merged
}

// ── Org context for the current user ─────────────────────────────────────────

export type OrgContext = {
  org:            Organization
  jobRoles:       JobRole[]
  shiftTemplates: ShiftTemplate[]
}

export async function getOrgContext(userId: string): Promise<OrgContext | null> {
  const membership = await db.membership.findFirst({
    where: { userId, role: "MANAGER" },
    include: {
      organization: {
        include: {
          jobRoles:       { orderBy: { name: "asc" } },
          shiftTemplates: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  })
  if (!membership) return null

  const { organization: o } = membership
  return {
    org:            serOrg(o),
    jobRoles:       o.jobRoles.map(serJobRole),
    shiftTemplates: o.shiftTemplates.map(serShiftTemplate),
  }
}

export async function getOrgForUser(userId: string): Promise<Organization | null> {
  const membership = await db.membership.findFirst({
    where: { userId, role: "MANAGER" },
    include: { organization: true },
    orderBy: { joinedAt: "asc" },
  })
  return membership ? serOrg(membership.organization) : null
}

// ── Team management ───────────────────────────────────────────────────────────

export type TeamMember = {
  userId:   string
  name:     string | null
  email:    string | null
  role:     string
  joinedAt: string
}

export async function listTeam(orgId: string): Promise<TeamMember[]> {
  const members = await db.membership.findMany({
    where: { organizationId: orgId, role: "MANAGER" },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { joinedAt: "asc" },
  })
  return members.map((m) => ({
    userId:   m.userId,
    name:     m.user.name,
    email:    m.user.email,
    role:     m.user.role,
    joinedAt: m.joinedAt.toISOString(),
  }))
}

export type AddedMember = Omit<TeamMember, "joinedAt">

export async function addTeamMember(
  orgId:        string,
  actingUserId: string,
  email:        string,
): Promise<AddedMember> {
  const target = await db.user.findUnique({ where: { email } })
  if (!target) throw new ServiceError("No account found with that email. Ask them to sign up first.", "NOT_FOUND")
  if (target.id === actingUserId) throw new ServiceError("You already have manager access.", "CONFLICT")

  await db.$transaction([
    db.membership.upsert({
      where:  { userId_organizationId: { userId: target.id, organizationId: orgId } },
      create: { userId: target.id, organizationId: orgId, role: "MANAGER" },
      update: { role: "MANAGER" },
    }),
    ...(target.role === "EMPLOYEE"
      ? [db.user.update({ where: { id: target.id }, data: { role: "MANAGER" } })]
      : []),
  ])

  return {
    userId: target.id,
    name:   target.name,
    email:  target.email,
    role:   target.role === "EMPLOYEE" ? "MANAGER" : target.role,
  }
}

export async function removeTeamMember(
  orgId:        string,
  actingUserId: string,
  targetUserId: string,
): Promise<void> {
  if (targetUserId === actingUserId) throw new ServiceError("You cannot remove your own access", "CONFLICT")

  const target = await db.user.findUnique({ where: { id: targetUserId } })
  if (!target) throw new ServiceError("User not found", "NOT_FOUND")
  if (target.role === "ADMIN") throw new ServiceError("Cannot remove an admin's access", "FORBIDDEN")

  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
  })
  if (!membership) throw new ServiceError("User is not a member of this organisation", "NOT_FOUND")

  await db.$transaction([
    db.membership.update({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
      data:  { role: "EMPLOYEE" },
    }),
    db.user.update({ where: { id: targetUserId }, data: { role: "EMPLOYEE" } }),
  ])
}

// ── Job roles ─────────────────────────────────────────────────────────────────

export async function listRoles(orgId: string): Promise<JobRole[]> {
  const roles = await db.jobRole.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
  })
  return roles.map(serJobRole)
}

// ── Shift templates ───────────────────────────────────────────────────────────

export async function listShiftTemplates(orgId: string): Promise<ShiftTemplate[]> {
  const templates = await db.shiftTemplate.findMany({
    where: { organizationId: orgId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  })
  return templates.map(serShiftTemplate)
}

export type CreateShiftTemplateInput = {
  name:          string
  startTime:     string
  endTime:       string
  breakMinutes?: number
  jobRole?:      string
  colorTag?:     string | null
}

export async function createShiftTemplate(
  orgId: string,
  input: CreateShiftTemplateInput,
): Promise<ShiftTemplate> {
  const [existing, count] = await Promise.all([
    db.shiftTemplate.findFirst({ where: { organizationId: orgId, name: input.name }, select: { id: true } }),
    db.shiftTemplate.count({ where: { organizationId: orgId } }),
  ])
  if (existing) throw new ServiceError("A shift type with this name already exists", "CONFLICT")

  const template = await db.shiftTemplate.create({
    data: {
      organizationId: orgId,
      name:           input.name,
      startTime:      input.startTime,
      endTime:        input.endTime,
      breakMinutes:   input.breakMinutes ?? 0,
      jobRole:        input.jobRole      ?? "",
      colorTag:       input.colorTag     ?? null,
      sortOrder:      count,
    },
  })
  return serShiftTemplate(template)
}

export async function deleteShiftTemplate(orgId: string, templateId: string): Promise<void> {
  const template = await db.shiftTemplate.findFirst({
    where: { id: templateId, organizationId: orgId },
    select: { id: true },
  })
  if (!template) throw new ServiceError("Not found", "NOT_FOUND")
  await db.shiftTemplate.delete({ where: { id: templateId } })
}

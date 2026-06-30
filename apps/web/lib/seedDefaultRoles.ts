import { db } from "@/lib/prisma"
import { PrismaClient } from "@/app/generated/prisma/client"

// Industry-neutral defaults so the product doesn't read as restaurant-only
// (a retail store or clinic would balk at "Server"/"Bartender"). Users add
// their own roles during onboarding and in Settings.
export const DEFAULT_JOB_ROLES = [
  { name: "Staff",      color: "blue"   },
  { name: "Shift lead", color: "purple" },
  { name: "Manager",    color: "green"  },
]

// Accepts an optional Prisma transaction client so it can be called inside a
// $transaction block. Falls back to the global db client when not in a transaction.
export async function seedDefaultRoles(
  organizationId: string,
  client?: PrismaClient,
) {
  const c = client ?? db
  await c.jobRole.createMany({
    skipDuplicates: true,
    data: DEFAULT_JOB_ROLES.map((r) => ({ ...r, organizationId })),
  })
}

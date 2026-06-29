import { db } from "@/lib/prisma"
import { PrismaClient } from "@/app/generated/prisma/client"

export const DEFAULT_JOB_ROLES = [
  { name: "Server",     color: "blue"   },
  { name: "Bartender",  color: "purple" },
  { name: "Kitchen",    color: "orange" },
  { name: "Cashier",    color: "yellow" },
  { name: "Supervisor", color: "green"  },
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

import { db } from "@/lib/prisma"

export const DEFAULT_JOB_ROLES = [
  { name: "Server",     color: "blue"   },
  { name: "Bartender",  color: "purple" },
  { name: "Kitchen",    color: "orange" },
  { name: "Cashier",    color: "yellow" },
  { name: "Supervisor", color: "green"  },
]

export async function seedDefaultRoles(organizationId: string) {
  await db.jobRole.createMany({
    skipDuplicates: true,
    data: DEFAULT_JOB_ROLES.map((r) => ({ ...r, organizationId })),
  })
}

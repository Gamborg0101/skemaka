import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL ?? "",
    connectionTimeoutMillis: 30_000,
  })
  return new PrismaClient({ adapter })
}

// Neon is serverless — each query uses its own short-lived connection, so there
// is no persistent pool to preserve. A fresh client on every hot-reload is fine
// and avoids stale model delegates after `prisma generate`.
export const db = createPrismaClient()

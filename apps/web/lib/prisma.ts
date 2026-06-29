import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"

// CI / local-testing only: route the Neon serverless driver at a local wsproxy
// (https://github.com/neondatabase/wsproxy) so the E2E suite can run against a
// plain Postgres container instead of a real Neon endpoint. Inert in production,
// where NEON_WS_PROXY is never set.
if (process.env.NEON_WS_PROXY) {
  neonConfig.wsProxy = () => process.env.NEON_WS_PROXY!
  neonConfig.useSecureWebSocket = false
  neonConfig.pipelineConnect = false
  neonConfig.pipelineTLS = false
}

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

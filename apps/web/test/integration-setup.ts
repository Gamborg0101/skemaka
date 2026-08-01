/**
 * Guard + lifecycle for the integration suite.
 *
 * These tests run real SQL against a real Postgres. The unit suite mocks Prisma,
 * which means it asserts the SHAPE of a query and can say nothing about what the
 * database does with it — that gap is how `colorTag: { not: "sick" }` shipped:
 * it compiles to `colorTag <> 'sick'`, which is NULL (not true) for uncoloured
 * rows, so they were silently dropped from roll-out and from payroll export.
 *
 * ⚠️ THE DANGER: `apps/web/.env.local` points DATABASE_URL at PRODUCTION. These
 * tests create and delete rows. Running them against that URL would destroy live
 * customer data, so the guard below refuses to start unless the target is
 * explicitly a throwaway database. Fail closed, never fail open.
 */
import { beforeAll } from "vitest"

/** Hosts that must never be written to by a test, whatever the env says. */
const FORBIDDEN_HOST_FRAGMENTS = [
  "neon.tech", // every Neon endpoint, production included
  "ep-twilight-cloud", // the known production endpoint, belt-and-braces
]

/** A target is acceptable only if it is unmistakably local/ephemeral. */
const ALLOWED_HOST_FRAGMENTS = ["localhost", "127.0.0.1", "0.0.0.0", "postgres"]

export function assertDisposableDatabase(url: string | undefined): string {
  if (!url) {
    throw new Error(
      "Integration tests need DATABASE_URL pointing at a disposable Postgres.\n" +
        "  local:  docker run --rm -e POSTGRES_PASSWORD=x -p 5432:5432 postgres:16\n" +
        "          DATABASE_URL=postgresql://postgres:x@localhost:5432/postgres npm run test:integration",
    )
  }

  const host = (() => {
    try {
      return new URL(url).hostname
    } catch {
      throw new Error("DATABASE_URL is not a valid URL")
    }
  })()

  for (const bad of FORBIDDEN_HOST_FRAGMENTS) {
    if (url.includes(bad)) {
      throw new Error(
        `REFUSING TO RUN: DATABASE_URL points at "${host}", which matches "${bad}".\n` +
          "Integration tests write and delete rows. They must never target a hosted\n" +
          "or production database. Point DATABASE_URL at a local/ephemeral Postgres.",
      )
    }
  }

  if (!ALLOWED_HOST_FRAGMENTS.some((ok) => host.includes(ok))) {
    throw new Error(
      `REFUSING TO RUN: DATABASE_URL host "${host}" is not recognisably local.\n` +
        `Allowed host fragments: ${ALLOWED_HOST_FRAGMENTS.join(", ")}.\n` +
        "This check fails closed on purpose — an unrecognised host is treated as\n" +
        "production, not as safe.",
    )
  }

  return url
}

beforeAll(() => {
  assertDisposableDatabase(process.env.DATABASE_URL)
})

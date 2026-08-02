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
      "Integration tests need DATABASE_URL pointing at a disposable Postgres,\n" +
        "plus a wsproxy — lib/prisma.ts always uses the Neon serverless driver,\n" +
        "which speaks WebSockets and cannot talk to a plain Postgres directly.\n\n" +
        "  With Docker:\n" +
        "    docker run --rm -e POSTGRES_PASSWORD=x -p 5432:5432 postgres:16\n" +
        "    docker run --rm -p 5433:80 -e APPEND_PORT=host.docker.internal:5432 \\\n" +
        "      -e ALLOW_ADDR_REGEX='.*' ghcr.io/neondatabase/wsproxy:latest\n\n" +
        "  Without Docker (macOS):\n" +
        "    brew install postgresql@16 go && brew services start postgresql@16\n" +
        "    go install github.com/neondatabase/wsproxy@latest\n" +
        "    LISTEN_PORT=:5433 APPEND_PORT=localhost:5432 ALLOW_ADDR_REGEX='.*' \\\n" +
        "      ~/go/bin/wsproxy &\n\n" +
        "  Then, from apps/web:\n" +
        "    createdb skemaka_test\n" +
        "    psql -d skemaka_test -c \"ALTER DATABASE skemaka_test SET TimeZone='Pacific/Kiritimati';\"\n" +
        "    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/skemaka_test \\\n" +
        "      NEON_WS_PROXY=localhost:5433/v1 npx prisma migrate deploy\n" +
        "    DATABASE_URL=... NEON_WS_PROXY=localhost:5433/v1 npm run test:integration",
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

/**
 * A deliberately non-UTC session timezone for the test database.
 *
 * Prisma maps `DateTime` to `timestamp WITHOUT time zone` and writes UTC
 * wall-clock into it. Raw SQL that compares such a column against `NOW()` (a
 * timestamptz) makes Postgres reinterpret the stored value in the SESSION's
 * timezone — so the comparison is wrong by the UTC offset. Under UTC the offset
 * is zero and the bug is invisible, which is exactly the condition every CI
 * runner provides by default.
 *
 * That is not hypothetical: `assertSeatAvailable` applied scheduled seat
 * reductions early for precisely this reason, and the test covering it passed in
 * CI regardless. Pinning a large positive offset means any future naive-vs-
 * timestamptz comparison fails loudly, in CI, on the first run.
 *
 * UTC+14 is the largest real offset there is, so it maximises the gap a bug has
 * to hide in.
 */
const TEST_SESSION_TIMEZONE = "Pacific/Kiritimati"

beforeAll(async () => {
  assertDisposableDatabase(process.env.DATABASE_URL)

  // ASSERT, don't set. `ALTER DATABASE … SET TimeZone` only applies to
  // connections opened afterwards, so doing it here races with connections the
  // driver has already established — which produced a run where the suite went
  // green against code that was definitely broken. Asserting is deterministic:
  // the timezone is either already right or the suite refuses to run.
  const { db } = await import("@/lib/prisma")
  const [{ tz }] = await db.$queryRawUnsafe<{ tz: string }[]>(
    "SELECT current_setting('TimeZone')::text AS tz",
  )

  if (tz === "UTC" || tz === "Etc/UTC") {
    throw new Error(
      `REFUSING TO RUN: the test database session timezone is "${tz}".\n\n` +
        "Under UTC this suite cannot see naive-vs-timestamptz bugs, because the\n" +
        "offset it would misread by is zero. That is not theoretical: seats.ts\n" +
        "applied scheduled seat reductions early for exactly this reason, and the\n" +
        "test covering it passed in CI regardless.\n\n" +
        "Point the database at a large offset so such bugs fail loudly:\n" +
        `  psql -c "ALTER DATABASE <db> SET TimeZone='${TEST_SESSION_TIMEZONE}';"`,
    )
  }
})

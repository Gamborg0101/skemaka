#!/usr/bin/env node
/**
 * Apply pending migrations against a database you name explicitly.
 *
 * NOT wired into the build command. It was, briefly, and the production deploy
 * failed immediately: `DATABASE_URL` is marked **Sensitive** in Vercel, and
 * sensitive variables are runtime-only — they are not exposed to the build
 * container. So a build-time migration step can never see the database here.
 *
 * Making it skip when the variable is missing would be worse than useless: it
 * would always skip, while looking like migrations were being applied on every
 * deploy. Better that applying a migration is a deliberate act.
 *
 * Usage — from apps/web, with a connection string you have checked twice:
 *
 *   DATABASE_URL='<prod>' npm run db:status    # look first, read-only
 *   DATABASE_URL='<prod>' npm run db:deploy    # then apply
 *
 * See docs/migrate-deploy-runbook.md. Production has not been baselined yet, so
 * `db:deploy` against it will fail until §2 of that runbook has been done.
 */

const { DATABASE_URL } = process.env

if (!DATABASE_URL) {
  console.error(
    "[migrate] DATABASE_URL is not set.\n" +
      "Pass it explicitly, e.g.\n" +
      "  DATABASE_URL='<connection string>' npm run db:deploy\n",
  )
  process.exit(1)
}

// Print enough to tell production from a scratch branch, and nothing more —
// a connection string carries the password.
const host = (() => {
  try { return new URL(DATABASE_URL).host } catch { return "unparseable" }
})()
console.log(`[migrate] target host: ${host}`)

const { spawnSync } = await import("node:child_process")
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
})

if (result.status !== 0) {
  console.error(
    "\n[migrate] migrate deploy FAILED.\n" +
      "If this is production and the error mentions an existing table (P3005 /\n" +
      "'relation already exists'), the database has not been baselined — its schema\n" +
      "came from `prisma db push`, so Prisma has no record of the migrations that\n" +
      "describe it. See §2 of docs/migrate-deploy-runbook.md. Do not force it.",
  )
  process.exit(result.status ?? 1)
}

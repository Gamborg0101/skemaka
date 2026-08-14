#!/usr/bin/env node
/**
 * Apply pending migrations, but only for a real production deploy.
 *
 * Guarded rather than putting `prisma migrate deploy` straight into the build
 * command, because the build runs for preview deploys too. Preview builds
 * inherit whatever DATABASE_URL the environment provides — which in this
 * project is the production database — so an unguarded migrate step would let
 * any pull request migrate production the moment Vercel built its preview.
 *
 * Skipping is always safe: the deploy proceeds and the schema is simply left
 * as it is. Failing is also safe: a migration that cannot apply stops the
 * deploy rather than shipping code against a schema that does not match it.
 */

const env = process.env.VERCEL_ENV ?? (process.env.VERCEL ? "unknown" : "local")

if (env !== "production") {
  console.log(`[migrate] VERCEL_ENV=${env} — skipping. Migrations run only on production deploys.`)
  process.exit(0)
}

if (!process.env.DATABASE_URL) {
  console.error("[migrate] DATABASE_URL is not set on a production deploy — refusing to continue.")
  process.exit(1)
}

const { spawnSync } = await import("node:child_process")

console.log("[migrate] production deploy — running `prisma migrate deploy`")
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
})

if (result.status !== 0) {
  console.error(
    "\n[migrate] migrate deploy FAILED — the deploy is being stopped on purpose.\n" +
      "The database does not match the migrations this build expects. Shipping anyway\n" +
      "would run new code against an old schema. See docs/migrate-deploy-runbook.md;\n" +
      "the usual causes are an un-baselined database or data that violates a new\n" +
      "constraint.",
  )
  process.exit(result.status ?? 1)
}

console.log("[migrate] migrations applied")
